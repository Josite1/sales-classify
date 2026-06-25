'''
Excel data processor: reads sales Excel + rules Excel, outputs classified JSON.
Fully vectorized version: minimal apply() calls, maximum numpy/pandas vector ops.
'''
import re
import io
from typing import Dict, List, Optional
import pandas as pd
import numpy as np


class ExcelProcessor:
    '''Reads sales Excel and keyword rules, classifies each row, outputs structured JSON.'''

    def __init__(self):
        self.reason_map: Dict[str, List[str]] = {}
        self.product_map: Dict[str, List[str]] = {}
        self.sales_data = None
        self.order_col = None
        self.shop_col = None
        # Pre-compiled patterns for vectorised classification
        self._reason_patterns: Dict[str, re.Pattern] = {}
        self._product_patterns: Dict[str, re.Pattern] = {}

    # ---- load rules ----
    def load_rules(self, rules_file: io.BytesIO) -> None:
        '''Load rules from Excel file (two sheets).'''
        reason_df = pd.read_excel(rules_file, sheet_name='售后原因')
        type_df = pd.read_excel(rules_file, sheet_name='品类')
        self.reason_map = {
            str(row['分类']): str(row['关键词']).split('-')
            for _, row in reason_df.iterrows() if not pd.isna(row['关键词'])
        }
        self.product_map = {
            str(row['品']): [k.strip() for k in str(row['关键词']).split('+')]
            for _, row in type_df.iterrows() if not pd.isna(row['关键词'])
        }
        self._build_patterns()

    def load_rules_from_dicts(self, reasons: List[dict], products: List[dict]) -> None:
        '''Load rules from pre-fetched dicts (from database).'''
        self.reason_map = {}
        for item in reasons:
            keys = item.get('keywords', item.get('关键词', ''))
            if keys:
                self.reason_map[item.get('category', item.get('分类', ''))] = keys.split('-')
        self.product_map = {}
        for item in products:
            keys = item.get('keywords', item.get('关键词', ''))
            if keys:
                self.product_map[item.get('category', item.get('品', ''))] = [
                    k.strip() for k in keys.split('+')
                ]
        self._build_patterns()

    def _build_patterns(self) -> None:
        '''Pre-compile regex patterns for vectorised classification.'''
        self._reason_patterns = {}
        for reason, keys in self.reason_map.items():
            # Escape special chars and join with | for OR matching
            escaped = '|'.join(re.escape(k) for k in keys if k)
            if escaped:
                self._reason_patterns[reason] = re.compile(escaped)

        self._product_patterns = {}
        for prod, keys in self.product_map.items():
            escaped = '|'.join(re.escape(k) for k in keys if k)
            if escaped:
                self._product_patterns[prod] = re.compile(escaped)

    # ---- classification helpers (vectorised) ----
    @staticmethod
    def _classify_vec(series: pd.Series, patterns: Dict[str, re.Pattern],
                      default: str = '其他', null_default: str = '无编码') -> np.ndarray:
        '''Vectorised classification: assign category based on regex contains.
           Returns a numpy array for fast indexing.'''
        n = len(series)
        result = np.full(n, default, dtype=object)
        null_mask = series.isna()
        if null_default:
            result[null_mask] = null_default
        # Process non-null values with compiled regex patterns
        valid = ~null_mask
        if valid.any():
            texts = series[valid]
            # For each category, build a boolean mask of matches
            matched = np.zeros(valid.sum(), dtype=bool)
            for cat, pattern in patterns.items():
                mask = texts.str.contains(pattern.pattern, na=False, regex=True)
                # Only assign to unmatched rows (first-match-wins)
                new_match = mask & ~matched
                if new_match.any():
                    idx = texts.index[new_match]
                    result[idx] = cat
                    matched |= new_match
        return result

    @staticmethod
    def _count_nums_vec(nums: np.ndarray, names: np.ndarray) -> np.ndarray:
        '''Vectorised quantity calculation.'''
        # Step 1: Vectorised get_product_code
        codes = np.ones(len(names), dtype=int)
        name_series = pd.Series(names)
        mask = name_series.str.contains('葱油饼|手抓饼', na=False)
        if mask.any():
            extracted = name_series[mask].str.extract(r'\*(\d+)', expand=False)
            codes[mask.values] = pd.to_numeric(extracted, errors='coerce').fillna(1).astype(int).values

        # Step 2: Vectorised quantity parsing
        num_series = pd.Series(nums)
        # Main path: straight numeric conversion
        result = pd.to_numeric(num_series, errors='coerce').fillna(0).astype(int)

        # Handle ':' separated numbers (rare case)
        colon_mask = num_series.astype(str).str.contains(':', na=False)
        if colon_mask.any():
            def _parse_colon(s):
                return sum(int(x) for x in str(s).replace('：', ':').split(':') if x.isdigit())
            result[colon_mask] = num_series[colon_mask].apply(_parse_colon)

        return (codes * result.values).astype(int)

    @staticmethod
    def get_province(addr) -> str:
        '''Extract province from address string.'''
        if not isinstance(addr, str):
            return '未知省份'
        parts = addr.split()
        return parts[0] if parts else '未知省份'

    @staticmethod
    def is_town(street) -> bool:
        '''Check if address is in a town/village.'''
        if pd.isna(street) or str(street).lower() == 'nan':
            return True
        return not ('乡' in str(street) or '镇' in str(street))

    # ---- column finder ----
    def _find_col(self, candidates: List[str]) -> Optional[str]:
        for col in candidates:
            if col in self.sales_data.columns:
                return col
        return None

    # ---- preprocessing (fully vectorised) ----
    def preprocess(self) -> pd.DataFrame:
        df = self.sales_data

        self.order_col = self._find_col(['订单号', '订单编号', '序号']) or '序号'
        self.shop_col = self._find_col(['店铺', '店铺名称', '店铺名', '店名'])
        if self.shop_col is None:
            df['店铺'] = '未知店铺'
            self.shop_col = '店铺'

        # Column detection
        product_code_col = self._find_col(['商家编码(新)', '平台商家编码', '商品编码']) or '商家编码(新)'
        remark_col = self._find_col(['客服备注', '备注']) or '客服备注'
        qty_col = self._find_col(['货品数量', '商品数量', '数量']) or '货品数量'
        addr_col = self._find_col(['收件人省市区', '收货地址', '省份', '省市区']) or '收件人省市区'
        street_col = self._find_col(['收件人街道', '乡镇', '街道/乡镇', '街道']) or '收件人街道'

        # ---- Vectorised transformations (MAIN OPTIMISATION) ----

        # 1. Product classification — vectorised regex
        df['品类'] = self._classify_vec(
            df[product_code_col], self._product_patterns, default='其他', null_default='无编码'
        )

        # 2. Reason classification — vectorised regex
        df['原因归类'] = self._classify_vec(
            df[remark_col], self._reason_patterns, default='其他', null_default='无备注'
        )

        # 3. Province — vectorised str split
        addr_series = df[addr_col].fillna('未知省份').astype(str)
        df['省份'] = addr_series.str.split().str[0]

        # 4. Town check — vectorised
        street_series = df[street_col].fillna('').astype(str)
        df['是否为乡镇'] = ~street_series.str.contains('乡|镇', na=False)

        # 5. Quantity — truly vectorised
        names = df[product_code_col].values
        qtys = df[qty_col].values
        df['数量分类'] = self._count_nums_vec(qtys, names)

        # 6. Flag color — vectorised
        flag_col = self._find_col(['标旗'])
        if flag_col is not None:
            df['标旗'] = df[flag_col].fillna('未标旗')
        else:
            status_col = self._find_col(['售后状态', '状态', '状态信息', 'Status'])
            if status_col is not None:
                status = df[status_col].fillna('').astype(str)
                df['标旗'] = '绿色旗子'
                red_mask = ~status.str.contains(
                    '退款成功|仅退款成功|退货退款成功|退款|仅退款|退货退款',
                    na=False
                ) & (status.str.strip() != '')
                df.loc[red_mask, '标旗'] = '红色旗子'
            else:
                df['标旗'] = '未标旗'

        self.sales_data = df
        return df

    # ---- analysis (optimised: fewer nested loops, batch operations) ----
    def analyze(self, df: pd.DataFrame) -> Dict:
        result = {}
        detail_cols = [self.order_col, '品类', '客服备注']
        detail_rename = {self.order_col: '订单号'}

        # Pre-compute commonly used groupby results
        cat_groups = df.groupby('品类', sort=False)
        flag_by_cat = {str(c): g.groupby('标旗', sort=False) for c, g in cat_groups}

        for cat_name, cat_df in cat_groups:
            cat_name = str(cat_name)
            c_len = len(cat_df)
            flag_groups = flag_by_cat[cat_name]

            # Flag counts — single value_counts is vectorised
            flag_counts = cat_df['标旗'].value_counts().to_dict()

            cat_result = {
                'total': c_len,
                '标旗分类': {str(k): int(v) for k, v in flag_counts.items()},
                '数量分类': {},
                '客服备注分类': {},
                '省份分类': {},
                '店铺分类': {},
            }

            if cat_name == '其他':
                cat_result['其他品类明细'] = (
                    cat_df[detail_cols].rename(columns=detail_rename).to_dict('records')
                )

            # Process each flag within this category
            for flag, flag_df in flag_groups:
                flag_name = str(flag)

                # 1. Quantity distribution — vectorised value_counts
                qty_vc = flag_df['数量分类'].value_counts().sort_index()
                cat_result['数量分类'][flag_name] = {str(k): int(v) for k, v in qty_vc.items()}

                # 2. Remark classification — single groupby
                remark_dict = {}
                for r_name, r_df in flag_df.groupby('原因归类', sort=False):
                    r_name_str = str(r_name)
                    if r_name_str == '其他':
                        remark_dict[r_name_str] = {
                            '订单数': len(r_df),
                            '明细': r_df[detail_cols].rename(columns=detail_rename).to_dict('records'),
                        }
                    else:
                        remark_dict[r_name_str] = len(r_df)
                cat_result['客服备注分类'][flag_name] = remark_dict

                # 3. Province distribution — vectorised agg
                prov_agg = flag_df.groupby('省份', sort=False).agg(
                    count=('是否为乡镇', 'count'),
                    town_count=('是否为乡镇', 'sum'),
                )
                cat_result['省份分类'][flag_name] = {
                    str(p): {'count': int(r['count']), 'town_village': int(r['town_count'])}
                    for p, r in prov_agg.iterrows()
                }

                # 4. Shop distribution — single groupby with nested aggregation
                shop_groups = flag_df.groupby(self.shop_col, sort=False)
                shop_dict = {}
                for shop, group in shop_groups:
                    shop_g_len = len(group)
                    qty_counts = group['数量分类'].value_counts().sort_index().to_dict()
                    shop_remark = {}
                    for r_name, r_df in group.groupby('原因归类', sort=False):
                        r_name_str = str(r_name)
                        if r_name_str == '其他':
                            shop_remark[r_name_str] = {
                                '订单数': len(r_df),
                                '明细': r_df[detail_cols].rename(columns=detail_rename).to_dict('records'),
                            }
                        else:
                            shop_remark[r_name_str] = len(r_df)
                    shop_dict[str(shop)] = {
                        'count': shop_g_len,
                        '数量分布': {str(k): int(v) for k, v in qty_counts.items()},
                        '客服备注分类': shop_remark,
                    }
                cat_result['店铺分类'][flag_name] = shop_dict

            result[cat_name] = cat_result

        return result

    # ---- load sales data ----
    def load_sales(self, sales_file: io.BytesIO, sheet_name: str = 'sheet') -> pd.DataFrame:
        '''Load sales data from Excel and run preprocessing.'''
        self.sales_data = pd.read_excel(sales_file, sheet_name=sheet_name)
        return self.preprocess()

    # ---- full pipeline ----
    def process(self, sales_file: io.BytesIO, rules_file: io.BytesIO) -> Dict:
        self.load_rules(rules_file)
        df = self.load_sales(sales_file)
        return self.analyze(df)

    def process_with_rules_dict(
        self, sales_file: io.BytesIO, reasons: List[dict], products: List[dict]
    ) -> Dict:
        self.load_rules_from_dicts(reasons, products)
        df = self.load_sales(sales_file)
        return self.analyze(df)

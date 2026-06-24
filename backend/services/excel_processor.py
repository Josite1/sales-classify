'''
Excel data processor: reads sales Excel + rules Excel, outputs classified JSON.
Optimized version: vectorized operations, to_dict('records') instead of iterrows.
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

    # ---- load rules ----
    def load_rules(self, rules_file: io.BytesIO) -> None:
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

    def load_rules_from_dicts(self, reasons: List[dict], products: List[dict]) -> None:
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

    # ---- classification helpers ----
    @staticmethod
    def classify_product(name, product_map: dict) -> str:
        if not isinstance(name, str):
            return '无编码'
        for prod, keys in product_map.items():
            for k in keys:
                if k in name:
                    return prod
        return '其他'

    @staticmethod
    def classify_reason(text, reason_map: dict) -> str:
        if not isinstance(text, str):
            return '无备注'
        for reason, keys in reason_map.items():
            for k in keys:
                if k in text:
                    return reason
        return '其他'

    @staticmethod
    def get_product_code(name) -> int:
        if not isinstance(name, str):
            return 1
        if '葱油饼' in name or '手抓饼' in name:
            code = re.search(r'\*(\d+)', name)
            return int(code.group(1)) if code else 1
        return 1

    @staticmethod
    def _parse_qty(num) -> int:
        '''Fast numeric quantity parser. Avoids try/except on common cases.'''
        if isinstance(num, (int, float)) and not pd.isna(num):
            return int(num)
        if pd.isna(num):
            return 0
        s = str(num).strip().replace('：', ':')
        if ':' in s:
            parts = s.split(':')
            return sum(int(x) for x in parts if x.isdigit())
        try:
            return int(float(s))
        except (ValueError, TypeError):
            return 1

    @staticmethod
    def _count_nums_vec(nums, names) -> np.ndarray:
        '''Vectorised quantity calculation.'''
        result = np.zeros(len(nums), dtype=int)
        for i in range(len(nums)):
            code = ExcelProcessor.get_product_code(names[i])
            val = ExcelProcessor._parse_qty(nums[i])
            result[i] = val * code
        return result

    @staticmethod
    def get_province(addr) -> str:
        if not isinstance(addr, str):
            return '未知省份'
        parts = addr.split()
        return parts[0] if parts else '未知省份'

    @staticmethod
    def is_town(street) -> bool:
        if pd.isna(street) or str(street).lower() == 'nan':
            return True
        return not ('乡' in str(street) or '镇' in str(street))

    # ---- column finder ----
    def _find_col(self, candidates: List[str]) -> Optional[str]:
        for col in candidates:
            if col in self.sales_data.columns:
                return col
        return None

    # ---- preprocessing (optimised) ----
    def preprocess(self) -> pd.DataFrame:
        df = self.sales_data

        self.order_col = self._find_col(['订单号', '订单编号', '序号']) or '序号'
        self.shop_col = self._find_col(['店铺', '店铺名称', '店铺名', '店名'])
        if self.shop_col is None:
            df['店铺'] = '未知店铺'
            self.shop_col = '店铺'

        product_code_col = self._find_col(['商家编码(新)', '平台商家编码', '商品编码']) or '商家编码(新)'
        remark_col = self._find_col(['客服备注', '备注']) or '客服备注'
        qty_col = self._find_col(['货品数量', '商品数量', '数量']) or '货品数量'
        addr_col = self._find_col(['收件人省市区', '收货地址', '省份', '省市区']) or '收件人省市区'
        street_col = self._find_col(['收件人街道', '乡镇', '街道/乡镇', '街道']) or '收件人街道'

        # Product classification
        pm = self.product_map
        df['品类'] = df[product_code_col].apply(
            lambda x: ExcelProcessor.classify_product(x, pm) if pd.notna(x) else '无编码'
        )

        # Reason classification
        rm = self.reason_map
        df['原因归类'] = df[remark_col].apply(
            lambda x: ExcelProcessor.classify_reason(x, rm) if pd.notna(x) else '无备注'
        )

        df['省份'] = df[addr_col].apply(ExcelProcessor.get_province)
        df['是否为乡镇'] = df[street_col].apply(ExcelProcessor.is_town)

        # Quantity calculation — vectorised
        names = df[product_code_col].values
        qtys = df[qty_col].values
        df['数量分类'] = ExcelProcessor._count_nums_vec(qtys, names)

        # Flag column
        flag_col = self._find_col(['标旗'])
        if flag_col is not None:
            df['标旗'] = df[flag_col].fillna('未标旗')
        else:
            status_col = self._find_col(['售后状态', '状态', '状态信息', 'Status'])
            if status_col is not None:
                def flag_color(status):
                    if not isinstance(status, str):
                        return '绿色旗子'
                    s = status.strip()
                    if s in ('退款成功', '仅退款成功', '退货退款成功', '退款', '仅退款', '退货退款'):
                        return '绿色旗子'
                    return '红色旗子'
                df['标旗'] = df[status_col].apply(flag_color)
            else:
                df['标旗'] = '未标旗'

        self.sales_data = df
        return df

    # ---- analysis (optimised) ----
    def analyze(self, df: pd.DataFrame) -> Dict:
        result = {}
        detail_cols = [self.order_col, '品类', '客服备注']

        cat_groups = df.groupby('品类')
        for cat_name, cat_df in cat_groups:
            cat_name = str(cat_name)
            cat_df = cat_df.copy()

            total = len(cat_df)
            flag_counts = cat_df['标旗'].value_counts().to_dict()
            cat_result = {
                'total': total,
                '标旗分类': {str(k): int(v) for k, v in flag_counts.items()},
                '数量分类': {},
                '客服备注分类': {},
                '省份分类': {},
                '店铺分类': {},
            }

            # "其他" category details
            if cat_name == '其他':
                cat_result['其他品类明细'] = cat_df[detail_cols].rename(
                    columns={self.order_col: '订单号'}
                ).to_dict('records')

            # Pre-group by flag
            flag_groups = cat_df.groupby('标旗')
            for flag, flag_df in flag_groups:
                flag_name = str(flag)

                # 1. Quantity distribution
                qty_series = flag_df['数量分类'].value_counts().sort_index()
                cat_result['数量分类'][flag_name] = {str(k): int(v) for k, v in qty_series.items()}

                # 2. Remark classification
                remark_dict = {}
                for r_name, r_df in flag_df.groupby('原因归类'):
                    r_name_str = str(r_name)
                    if r_name_str == '其他':
                        remark_dict[r_name_str] = {
                            '订单数': len(r_df),
                            '明细': r_df[detail_cols].rename(
                                columns={self.order_col: '订单号'}
                            ).to_dict('records'),
                        }
                    else:
                        remark_dict[r_name_str] = len(r_df)
                cat_result['客服备注分类'][flag_name] = remark_dict

                # 3. Province distribution
                prov_town = flag_df.groupby('省份').agg(
                    count=('是否为乡镇', 'count'),
                    town_count=('是否为乡镇', lambda x: (~x).sum()),
                )
                cat_result['省份分类'][flag_name] = {
                    str(p): {'count': int(r['count']), 'town_village': int(r['town_count'])}
                    for p, r in prov_town.iterrows()
                }

                # 4. Shop distribution
                shop_dict = {}
                for shop, group in flag_df.groupby(self.shop_col):
                    qty_counts = group['数量分类'].value_counts().sort_index().to_dict()
                    shop_remark = {}
                    for r_name, r_df in group.groupby('原因归类'):
                        r_name_str = str(r_name)
                        if r_name_str == '其他':
                            shop_remark[r_name_str] = {
                                '订单数': len(r_df),
                                '明细': r_df[detail_cols].rename(
                                    columns={self.order_col: '订单号'}
                                ).to_dict('records'),
                            }
                        else:
                            shop_remark[r_name_str] = len(r_df)
                    shop_dict[str(shop)] = {
                        'count': len(group),
                        '数量分布': {str(k): int(v) for k, v in qty_counts.items()},
                        '客服备注分类': shop_remark,
                    }
                cat_result['店铺分类'][flag_name] = shop_dict

            result[cat_name] = cat_result

        return result

    # ---- load sales data ----
    def load_sales(self, sales_file: io.BytesIO, sheet_name: str = 'sheet') -> pd.DataFrame:
        '''Load sales data from Excel, return preprocessed DataFrame.'''
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

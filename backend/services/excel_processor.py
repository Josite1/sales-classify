'''
Excel data processor: reads sales Excel + rules Excel, outputs classified JSON.
Ported from 2.py SalesAnalyzer.
'''
import re
import io
from typing import Dict, List, Optional
import pandas as pd


class ExcelProcessor:
    '''
    Reads sales Excel data and keyword rules, classifies each row,
    and produces the structured JSON expected by the frontend.
    '''

    def __init__(self):
        self.reason_map: Dict[str, List[str]] = {}
        self.product_map: Dict[str, List[str]] = {}
        self.sales_data = None
        self.order_col = None
        self.shop_col = None

    # ---- load rules ----
    def load_rules(self, rules_file: io.BytesIO) -> None:
        '''Load keyword rules from Excel. Expects sheets: 售后原因, 品类'''
        reason_df = pd.read_excel(rules_file, sheet_name='售后原因')
        type_df = pd.read_excel(rules_file, sheet_name='品类')

        self.reason_map = {}
        for _, row in reason_df.iterrows():
            if pd.isna(row['关键词']):
                continue
            self.reason_map[str(row['分类'])] = str(row['关键词']).split('-')

        self.product_map = {}
        for _, row in type_df.iterrows():
            if pd.isna(row['关键词']):
                continue
            self.product_map[str(row['品'])] = [
                k.strip() for k in str(row['关键词']).split('+')
            ]

    def load_rules_from_dicts(self, reasons: List[dict], products: List[dict]) -> None:
        '''Load rules from dicts (for keyword management API).'''
        self.reason_map = {}
        for item in reasons:
            keys = item.get('keywords', item.get('关键词', ''))
            if not keys:
                continue
            self.reason_map[item.get('category', item.get('分类', ''))] = keys.split('-')

        self.product_map = {}
        for item in products:
            keys = item.get('keywords', item.get('关键词', ''))
            if not keys:
                continue
            self.product_map[item.get('category', item.get('品', ''))] = [
                k.strip() for k in keys.split('+')
            ]

    # ---- load sales data ----
    def load_sales(self, sales_file: io.BytesIO, sheet_name: str = 'sheet') -> pd.DataFrame:
        '''Load sales data from Excel, return processed DataFrame.'''
        self.sales_data = pd.read_excel(sales_file, sheet_name=sheet_name)
        return self.preprocess()

    # ---- classification helpers ----
    @staticmethod
    def classify_product(name: str, product_map: dict) -> str:
        if not isinstance(name, str):
            return '无编码'
        for prod, keys in product_map.items():
            for k in keys:
                if k in name:
                    return prod
        return '其他'

    @staticmethod
    def classify_reason(text: str, reason_map: dict) -> str:
        if not isinstance(text, str):
            return '无备注'
        for reason, keys in reason_map.items():
            for k in keys:
                if k in text:
                    return reason
        return '其他'

    @staticmethod
    def get_product_code(name: str) -> int:
        if not isinstance(name, str):
            return 1
        if '葱油饼' in name or '手抓饼' in name:
            code = re.search(r'\*(\d+)', name)
            return int(code.group(1)) if code else 1
        return 1

    @staticmethod
    def count_nums(num, name: str) -> int:
        code = ExcelProcessor.get_product_code(name)
        if pd.isna(num):
            return 0
        if isinstance(num, (int, float)):
            return int(num) * code
        s = str(num).strip().replace('：', ':')
        if ':' in s:
            try:
                return sum(int(x) for x in s.split(':') if x.isdigit()) * code
            except Exception:
                return code
        else:
            try:
                return int(float(s)) * code
            except Exception:
                return code

    @staticmethod
    def get_province(addr: str) -> str:
        if not isinstance(addr, str):
            return '未知省份'
        parts = addr.split()
        return parts[0] if parts else '未知省份'

    @staticmethod
    def is_town(street) -> bool:
        if pd.isna(street) or str(street).lower() == 'nan':
            return True   # 非乡镇
        return not ('乡' in str(street) or '镇' in str(street))

    # ---- 列名查找辅助 ----
    def _find_col(self, candidates: List[str]) -> Optional[str]:
        '''在sales_data中查找第一个匹配的列名'''
        for col in candidates:
            if col in self.sales_data.columns:
                return col
        return None

    # ---- preprocessing ----
    def preprocess(self) -> pd.DataFrame:
        df = self.sales_data

        # 确定订单号列（与原版一致）
        self.order_col = self._find_col(['订单号', '订单编号', '序号']) or '序号'

        # 确定店铺列（与原版一致）
        self.shop_col = self._find_col(['店铺', '店铺名称', '店铺名', '店名'])
        if self.shop_col is None:
            df['店铺'] = '未知店铺'
            self.shop_col = '店铺'

        # 确定商家编码列（原版使用'商家编码(新)'）
        product_code_col = self._find_col(['商家编码(新)', '平台商家编码', '商品编码']) or '商家编码(新)'

        # 确定客服备注列
        remark_col = self._find_col(['客服备注', '备注']) or '客服备注'

        # 确定货品数量列（原版使用'货品数量'）
        qty_col = self._find_col(['货品数量', '商品数量', '数量']) or '货品数量'

        # 确定省市区列（原版使用'收件人省市区'）
        addr_col = self._find_col(['收件人省市区', '收货地址', '省份', '省市区']) or '收件人省市区'

        # 确定街道列（原版使用'收件人街道'）
        street_col = self._find_col(['收件人街道', '乡镇', '街道/乡镇', '街道']) or '收件人街道'

        # 应用分类和计算（与原版完全一致）
        df['品类'] = df[product_code_col].apply(
            lambda x: self.classify_product(x, self.product_map) if pd.notna(x) else '无编码'
        )

        df['原因归类'] = df[remark_col].apply(
            lambda x: self.classify_reason(x, self.reason_map) if pd.notna(x) else '无备注'
        )

        df['省份'] = df[addr_col].apply(self.get_province)

        df['是否为乡镇'] = df[street_col].apply(self.is_town)

        df['数量分类'] = df.apply(
            lambda r: self.count_nums(r.get(qty_col, 1), r.get(product_code_col, '')),
            axis=1
        )

        # 标旗：与原版一致，直接从'标旗'列读取，不存在则填充'未标旗'
        flag_col = self._find_col(['标旗'])
        if flag_col is not None:
            df['标旗'] = df[flag_col].fillna('未标旗')
        else:
            # 如果没有标旗列，根据售后状态推断（与原版逻辑保持一致）
            status_col = self._find_col(['售后状态', '状态', '状态信息', 'Status'])
            if status_col is not None:
                def flag_color(status):
                    if not isinstance(status, str):
                        return '绿色旗子'
                    s = status.strip()
                    if s in ['退款成功', '仅退款成功', '退货退款成功', '退款', '仅退款', '退货退款']:
                        return '绿色旗子'
                    return '红色旗子'
                df['标旗'] = df[status_col].apply(flag_color)
            else:
                df['标旗'] = '未标旗'

        self.sales_data = df
        return df

    # ---- analysis ----
    def analyze(self, df: pd.DataFrame) -> Dict:
        result = {}

        for cat_name, cat_df in df.groupby('品类'):
            cat_name = str(cat_name)
            cat_result = {
                'total': 0,
                '标旗分类': {},
                '数量分类': {},
                '客服备注分类': {},
                '省份分类': {},
                '店铺分类': {},
            }

            # Total
            cat_result['total'] = len(cat_df)

            # Flag counts
            flag_counts = cat_df['标旗'].value_counts().to_dict()
            cat_result['标旗分类'] = {str(k): int(v) for k, v in flag_counts.items()}

            # Other products detail（与原版一致）
            if cat_name == '其他':
                cat_result['其他品类明细'] = [
                    {
                        '订单号': str(row[self.order_col]),
                        '品类': str(row['品类']),
                        '客服备注': str(row['客服备注']),
                    }
                    for _, row in cat_df.iterrows()
                ]

            for flag in cat_df['标旗'].unique():
                flag_df = cat_df[cat_df['标旗'] == flag]
                flag_name = str(flag)

                # 1. 标旗下的数量分类
                qty = flag_df['数量分类'].value_counts().sort_index().to_dict()
                cat_result['数量分类'][flag_name] = {
                    str(k): int(v) for k, v in qty.items()
                }

                # 2. 标旗下的客服备注分类
                reason_dict = {}
                for r_name, r_df in flag_df.groupby('原因归类'):
                    r_name_str = str(r_name)
                    if r_name_str == '其他':
                        reason_dict[r_name_str] = {
                            '订单数': len(r_df),
                            '明细': [
                                {
                                    '订单号': str(row[self.order_col]),
                                    '品类': str(row['品类']),
                                    '客服备注': str(row['客服备注']),
                                }
                                for _, row in r_df.iterrows()
                            ],
                        }
                    else:
                        reason_dict[r_name_str] = len(r_df)
                cat_result['客服备注分类'][flag_name] = reason_dict

                # 3. 省份分类（含乡镇数量）
                prov_dict = {}
                for prov, prov_df in flag_df.groupby('省份'):
                    town_cnt = prov_df['是否为乡镇'].value_counts().get(False, 0)
                    prov_dict[str(prov)] = {
                        'count': len(prov_df),
                        'town_village': int(town_cnt),
                    }
                cat_result['省份分类'][flag_name] = prov_dict

                # 4. 店铺分类（含数量分布 + 客服备注分类）
                shop_groups = flag_df.groupby(self.shop_col)
                shop_dict = {}
                for shop, group in shop_groups:
                    qty_counts = group['数量分类'].value_counts().sort_index().to_dict()
                    shop_reason_dict = {}
                    for r_name, r_df in group.groupby('原因归类'):
                        r_name_str = str(r_name)
                        if r_name_str == '其他':
                            shop_reason_dict[r_name_str] = {
                                '订单数': len(r_df),
                                '明细': [
                                    {
                                        '订单号': str(row[self.order_col]),
                                        '品类': str(row['品类']),
                                        '客服备注': str(row['客服备注']),
                                    }
                                    for _, row in r_df.iterrows()
                                ],
                            }
                        else:
                            shop_reason_dict[r_name_str] = len(r_df)
                    shop_dict[str(shop)] = {
                        'count': int(len(group)),
                        '数量分布': {str(k): int(v) for k, v in qty_counts.items()},
                        '客服备注分类': shop_reason_dict,
                    }
                cat_result['店铺分类'][flag_name] = shop_dict

            result[cat_name] = cat_result

        return result

    # ---- full pipeline ----
    def process(self, sales_file: io.BytesIO, rules_file: io.BytesIO) -> Dict:
        '''Full pipeline: load rules, load sales, analyze. Returns result dict.'''
        self.load_rules(rules_file)
        df = self.load_sales(sales_file)
        return self.analyze(df)

    def process_with_rules_dict(
        self,
        sales_file: io.BytesIO,
        reasons: List[dict],
        products: List[dict],
    ) -> Dict:
        '''Process using pre-loaded keyword rules from dicts.'''
        self.load_rules_from_dicts(reasons, products)
        df = self.load_sales(sales_file)
        return self.analyze(df)
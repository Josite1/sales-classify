'''
Pydantic data models matching TypeScript types.
'''
from typing import Optional, Union, Dict, List
from pydantic import BaseModel, Field


class RemarkOtherDetail(BaseModel):
    order_id: str = Field(alias='订单号')
    category: str = Field(alias='品类')
    remark: str = Field(alias='客服备注')

    class Config:
        populate_by_name = True


class RemarkOtherValue(BaseModel):
    order_count: int = Field(alias='订单数')
    details: List[RemarkOtherDetail] = Field(alias='明细')

    class Config:
        populate_by_name = True


RemarkValue = Union[int, RemarkOtherValue]


class RegionItem(BaseModel):
    count: int
    town_village: int


class ShopItem(BaseModel):
    count: int
    qty_distribution: Dict[str, int] = Field(alias='数量分布')
    remark_flags: Dict[str, RemarkValue] = Field(alias='客服备注分类')

    class Config:
        populate_by_name = True


class DateRecord(BaseModel):
    date: str
    data: Dict[str, Dict]
    imported_at: float = Field(alias='importedAt')

    class Config:
        populate_by_name = True


class WeekSummary(BaseModel):
    week_label: str
    week_start: str
    week_end: str
    total_orders: int
    product_count: int
    products: Dict[str, int]
    red_flags: int
    top_reasons: Dict[str, int]


class DaySummary(BaseModel):
    date: str
    total_orders: int
    red_flags: int
    product_breakdown: List[dict]
    top_reasons: List[list]

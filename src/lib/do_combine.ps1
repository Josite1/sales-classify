$files = @(
  'D:\workplace\python\classify_sales\src\lib\store.ts',
  'D:\workplace\python\classify_sales\src\lib\store_part2.ts',
  'D:\workplace\python\classify_sales\src\lib\func_computeAggregated.ts',
  'D:\workplace\python\classify_sales\src\lib\func_cloudLoad.ts',
  'D:\workplace\python\classify_sales\src\lib\func_cloudSave.ts',
  'D:\workplace\python\classify_sales\src\lib\func_merge.ts'
)
Get-Content $files | Set-Content D:\workplace\python\classify_sales\src\lib\store_final.ts

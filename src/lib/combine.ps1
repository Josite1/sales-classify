$a = Get-Content D:\workplace\python\classify_sales\src\lib\store.ts
$b = Get-Content D:\workplace\python\classify_sales\src\lib\store_part2.ts
$a + $b | Set-Content D:\workplace\python\classify_sales\src\lib\store_complete.ts

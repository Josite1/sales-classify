$part1 = 'D:\workplace\python\classify_sales\src\lib\store.ts'
$part2 = 'D:\workplace\python\classify_sales\src\lib\store_part2.ts'
$func1 = 'D:\workplace\python\classify_sales\src\lib\func_computeAggregated.ts'
$func2 = 'D:\workplace\python\classify_sales\src\lib\func_cloudLoad.ts'
$func3 = 'D:\workplace\python\classify_sales\src\lib\func_cloudSave.ts'
$func4 = 'D:\workplace\python\classify_sales\src\lib\func_merge.ts'
$out = 'D:\workplace\python\classify_sales\src\lib\store_combined.ts'

$content = ''
$content += [System.IO.File]::ReadAllText($part1)
$content += [System.IO.File]::ReadAllText($part2)
$content += [System.IO.File]::ReadAllText($func1)
$content += [System.IO.File]::ReadAllText($func2)
$content += [System.IO.File]::ReadAllText($func3)
$content += [System.IO.File]::ReadAllText($func4)
[System.IO.File]::WriteAllText($out, $content)
Write-Host 'done'

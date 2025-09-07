# 测试文本清理功能 (PowerShell版本)
Write-Host "🚀 开始测试文本清理功能..." -ForegroundColor Green
Write-Host "=" * 50

# 测试数据
$testTexts = @(
    "这是一个测试文本，包含一些特殊字符：`n`r`t",
    "另一个测试，包含多余空格  和   标点符号，，，！！",
    "测试Unicode字符：📝✅❌",
    "测试HTML标签：<div>内容</div>",
    "测试URL：https://example.com/path",
    "测试邮箱：user@example.com",
    "测试数字：123-456-7890"
)

for ($i = 0; $i -lt $testTexts.Length; $i++) {
    $text = $testTexts[$i]
    Write-Host "`n测试 $($i + 1):"
    Write-Host "原始文本: $text"
    
    # 简单的清理演示
    $cleaned = $text -replace '\s+', ' ' -replace '[，,！]+', ''
    Write-Host "清理后: $cleaned"
    
    Write-Host "-" * 30
}

Write-Host "✅ 文本清理功能测试完成！" -ForegroundColor Green
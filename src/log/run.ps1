# ClashLogger 启动脚本 - 使用锁文件防止重复运行

$LockFile = "F:\wlDriver_github_learn\clash_log\.clash_logger.lock"
$ScriptPath = "F:\wlDriver_github_learn\clash_log\clash_logger.py"
$PythonPath = "F:\wlDriver_github_learn\clash_log\.venv\Scripts\pythonw.exe"

# 检查锁文件是否存在
if (Test-Path $LockFile) {
    try {
        $lockContent = Get-Content $LockFile -ErrorAction Stop
        $oldPid = [int]$lockContent

        # 检查该 PID 的进程是否还在运行
        $oldProcess = Get-Process -Id $oldPid -ErrorAction SilentlyContinue

        # 注意：PowerShell 中 ProcessName 不带 .exe
        if ($oldProcess -and ($oldProcess.ProcessName -eq "pythonw" -or $oldProcess.ProcessName -eq "python")) {
            Write-Host "ClashLogger 已经在运行中 (PID: $oldPid)" -ForegroundColor Yellow
            Write-Host "无需重复启动" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "检测到过期的锁文件，清理中..." -ForegroundColor Cyan
            Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host "锁文件异常，清理中..." -ForegroundColor Cyan
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}

# 启动 Python 进程
try {
    $process = Start-Process -FilePath $PythonPath -ArgumentList $ScriptPath -WindowStyle Hidden -PassThru

    # 将实际的 Python 进程 PID 写入锁文件
    $process.Id | Out-File -FilePath $LockFile -Encoding utf8

    Write-Host "ClashLogger 已成功启动 (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "日志数据库: C:\Users\zkt16\AppData\Roaming\com.follow\clash\history.db" -ForegroundColor Cyan
} catch {
    Write-Host "启动失败: $_" -ForegroundColor Red
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    exit 1
}
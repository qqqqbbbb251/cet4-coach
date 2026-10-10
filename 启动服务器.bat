@echo off
chcp 65001 >nul
title 四级备考 - 本地服务器
echo ============================================
echo            四级备考  CET-4 Coach
echo ============================================
echo.
echo  本机 IP 地址(平板请用同一 WiFi 访问下面地址):
echo.
ipconfig | findstr /i "IPv4"
echo.
echo  平板浏览器打开:  http://上面显示的IP:8000
echo  例如:  http://192.168.1.5:8000
echo.
echo  关闭此窗口即停止服务。
echo ============================================
echo.
python -m http.server 8000
pause

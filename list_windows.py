import Quartz

# すべてのウィンドウ情報を取得
options = Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements
window_list = Quartz.CGWindowListCopyWindowInfo(options, Quartz.kCGNullWindowID)

print(f"{'ID':<10} {'Owner':<20} {'Name'}")
print("-" * 50)

for window in window_list:
    pid = window.get('kCGWindowOwnerPID', '')
    owner = window.get('kCGWindowOwnerName', '')
    name = window.get('kCGWindowName', '')
    wid = window.get('kCGWindowNumber', '')

    # 名前があるウィンドウのみ表示（調整可能）
    if name:
        print(f"{wid:<10} {owner:<20} {name}")
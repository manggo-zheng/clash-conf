"""
FlClash/Clash Meta 连接与日志记录器
WebSocket 监听连接生命周期 + 日志流，写入 SQLite
"""

import asyncio
import ctypes
import json
import sqlite3
import sys
from datetime import datetime

import websockets

# 配置（就一个脚本，自己改）
DB_PATH = r"C:\Users\zkt16\AppData\Roaming\com.follow\clash\history.db"
API_BASE = "http://127.0.0.1:9090"
WS_LOGS = "ws://127.0.0.1:9090/logs"
WS_TRAFFIC = "ws://127.0.0.1:9090/traffic"

active_connections = {}
_mutex = None


def set_process_title():
    """设置进程标题以便识别"""
    try:
        import ctypes
        ctypes.windll.kernel32.SetConsoleTitleW("ClashLogger")
    except Exception:
        pass


def enforce_single_instance():
    """使用 Windows Mutex 确保全局只有一个实例运行"""
    global _mutex
    mutex_name = "Global\\ClashLogger_Unique_Mutex_Zkt16"
    _mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)

    # 183 表示 ERROR_ALREADY_EXISTS
    if ctypes.windll.kernel32.GetLastError() == 183:
        print("ClashLogger 已经在运行中了，退出当前实例。")
        sys.exit(0)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS connections
                 (
                     id
                     TEXT
                     PRIMARY
                     KEY,
                     network
                     TEXT,
                     TYPE
                     TEXT,
                     host
                     TEXT,
                     destinationIP
                     TEXT,
                     destinationPort
                     TEXT,
                     sourceIP
                     TEXT,
                     sourcePort
                     TEXT,
                     process
                     TEXT,
                     processPath
                     TEXT,
                     remoteDestination
                     TEXT,
                     upload
                     INTEGER,
                     download
                     INTEGER,
                     start_time
                     TEXT,
                     close_time
                     TEXT,
                     duration_s
                     REAL,
                     chains
                     TEXT,
                     rule
                     TEXT,
                     rulePayload
                     TEXT,
                     inboundName
                     TEXT
                 )""")
    c.execute("""CREATE TABLE IF NOT EXISTS logs
                 (
                     id
                     INTEGER
                     PRIMARY
                     KEY
                     AUTOINCREMENT,
                     TIME
                     TEXT,
                     TYPE
                     TEXT,
                     payload
                     TEXT
                 )""")
    c.execute("CREATE INDEX IF NOT EXISTS idx_conn_start ON connections(start_time)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_conn_host ON connections(host)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(TIME)")
    conn.commit()
    conn.close()


def insert_connection(conn_data, close_time=None):
    meta = conn_data.get("metadata", {})
    start = conn_data.get("start", "")
    ct = close_time or datetime.now().isoformat(timespec="seconds")
    dur = None
    if start:
        try:
            st = datetime.fromisoformat(start)
            dur = (datetime.fromisoformat(ct) - st).total_seconds()
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """INSERT OR REPLACE INTO connections
        (id, network, type, host, destinationIP, destinationPort,
         sourceIP, sourcePort, process, processPath, remoteDestination,
         upload, download, start_time, close_time, duration_s,
         chains, rule, rulePayload, inboundName)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            conn_data.get("id"),
            meta.get("network"),
            meta.get("type"),
            meta.get("host"),
            meta.get("destinationIP"),
            meta.get("destinationPort"),
            meta.get("sourceIP"),
            meta.get("sourcePort"),
            meta.get("process"),
            meta.get("processPath"),
            meta.get("remoteDestination"),
            conn_data.get("upload", 0),
            conn_data.get("download", 0),
            start,
            ct,
            dur,
            json.dumps(conn_data.get("chains", []), ensure_ascii=False),
            conn_data.get("rule"),
            conn_data.get("rulePayload"),
            meta.get("inboundName"),
        ),
    )
    conn.commit()
    conn.close()


def insert_log(log_type, payload):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO logs (time, type, payload) VALUES (?,?,?)",
        (datetime.now().isoformat(timespec="seconds"), log_type, payload),
    )
    conn.commit()
    conn.close()


async def poll_connections():
    """Poll /connections periodically to capture active connections and detect closed ones."""
    import aiohttp

    seen_ids = set()

    # 修复: 将 Session 放在循环外部，复用同一个 HTTP 客户端
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(f"{API_BASE}/connections") as resp:
                    data = await resp.json()

                current_ids = set()
                for c in data.get("connections", []):
                    cid = c.get("id")
                    current_ids.add(cid)
                    active_connections[cid] = c
                    if cid not in seen_ids:
                        insert_connection(c)

                # Detect closed connections
                closed = seen_ids - current_ids
                for cid in closed:
                    if cid in active_connections:
                        insert_connection(active_connections[cid], close_time=datetime.now().isoformat(timespec="seconds"))
                        del active_connections[cid]

                seen_ids = current_ids
            except Exception as e:
                print(f"[connections] poll error: {e}", file=sys.stderr)

            await asyncio.sleep(2)


async def listen_logs():
    """Listen to /logs WebSocket stream."""
    while True:
        try:
            async with websockets.connect(WS_LOGS, ping_interval=None) as ws:
                print("[logs] connected")
                async for msg in ws:
                    try:
                        data = json.loads(msg)
                        print(f"[logs] Received: {data}")  # 打印接收到的日志用于测试
                        insert_log(data.get("type", ""), data.get("payload", ""))
                    except Exception as e:
                        print(f"[logs] Parse error: {e}", file=sys.stderr)
        except Exception as e:
            print(f"[logs] ws error: {e}, reconnecting in 5s...", file=sys.stderr)
            await asyncio.sleep(5)


async def main():
    enforce_single_instance()
    set_process_title()
    init_db()
    print(f"Recording to {DB_PATH}")
    print("Press Ctrl+C to stop")

    await asyncio.gather(
        poll_connections(),
        listen_logs(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # Save close time for remaining active connections
        now = datetime.now().isoformat(timespec="seconds")
        for cid, c in active_connections.items():
            insert_connection(c, close_time=now)
        print(f"\nStopped. {len(active_connections)} active connections saved with close time.")

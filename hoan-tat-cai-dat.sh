#!/bin/bash
# ============================================================
# SMC Training — hoàn tất cài đặt trên máy mới
# Chạy:  bash hoan-tat-cai-dat.sh
# Cần mạng Internet (bước npm install tải thư viện về).
# ============================================================
set -uo pipefail

DUAN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$(cd "$DUAN/../_tools/node-v20.20.2/bin" && pwd)"
export PATH="$NODE_BIN:$PATH"

echo "▶ Node: $(node --version)   npm: $(npm --version)"
echo "▶ Dự án: $DUAN"
echo ""

cd "$DUAN" || exit 1

echo "▶ Cài thư viện (1–3 phút)..."
# --legacy-peer-deps: @vitejs/plugin-react@4 còn trong package.json yêu cầu Vite 4–7,
# trong khi dự án đã lên Vite 8. Plugin không còn dùng trong vite.config.js nên bỏ qua
# peer dependency là an toàn.
npm install --no-audit --no-fund --legacy-peer-deps || {
    echo "✗ npm install thất bại — kiểm tra kết nối mạng."
    exit 1
}

# esbuild 0.21.5 mà Vite bundle lồng bên trong gây TREO BUILD vô hạn trên macOS mới.
if [[ -d node_modules/vite/node_modules ]]; then
    rm -rf node_modules/vite/node_modules
    echo "▶ Đã xóa esbuild lồng trong vite (nguyên nhân treo build)"
fi

echo ""
echo "▶ Build thử (bình thường ~1 giây)..."
npm run build || { echo "✗ Build lỗi"; exit 1; }

echo ""
if [[ -f dist/index.html ]]; then
    echo "✅ XONG. Build ra: $(ls -1 dist/assets/ | tr '\n' ' ')"
else
    echo "✗ Không thấy dist/index.html"
    exit 1
fi

echo ""
echo "Lệnh thường dùng (nhớ export PATH trước, hoặc thêm vào ~/.zshrc):"
echo "  export PATH=\"$NODE_BIN:\$PATH\""
echo "  npm run dev        # chạy thử ở máy"
echo "  bash deploy.sh     # đưa lên smc-training.com"

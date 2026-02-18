#!/bin/bash

# Setup Encrypted DNS (DNS over HTTPS) using Cloudflare
# This encrypts DNS queries so your ISP can't see which domains you're accessing

set -e

echo "====================================="
echo "  Encrypted DNS Setup (Cloudflare)"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./setup-encrypted-dns.sh"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    armv7l|armv6l)
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
        ;;
    aarch64)
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
        ;;
    x86_64)
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Detected architecture: $ARCH"
echo ""

# Download cloudflared
echo "[1/5] Downloading cloudflared..."
curl -L -o /usr/local/bin/cloudflared "$CLOUDFLARED_URL"
chmod +x /usr/local/bin/cloudflared

# Verify installation
echo "[2/5] Verifying installation..."
/usr/local/bin/cloudflared --version

# Create cloudflared user
echo "[3/5] Creating cloudflared user..."
id -u cloudflared &>/dev/null || useradd -r -s /usr/sbin/nologin cloudflared

# Create config directory
mkdir -p /etc/cloudflared

# Create config file
echo "[4/5] Creating configuration..."
cat > /etc/cloudflared/config.yml << 'EOF'
# Cloudflare DNS over HTTPS proxy configuration
proxy-dns: true
proxy-dns-port: 5053
proxy-dns-upstream:
  - https://1.1.1.1/dns-query
  - https://1.0.0.1/dns-query
# Optional: Use Cloudflare's malware-blocking DNS instead:
# - https://security.cloudflare-dns.com/dns-query
# Optional: Use Cloudflare's family-safe DNS (blocks malware + adult content):
# - https://family.cloudflare-dns.com/dns-query
EOF

# Create systemd service
echo "[5/5] Creating systemd service..."
cat > /etc/systemd/system/cloudflared-dns.service << 'EOF'
[Unit]
Description=Cloudflare DNS over HTTPS Proxy
After=network.target

[Service]
Type=simple
User=cloudflared
ExecStart=/usr/local/bin/cloudflared --config /etc/cloudflared/config.yml
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable cloudflared-dns
systemctl start cloudflared-dns

# Wait for service to start
sleep 2

# Test the DNS proxy
echo ""
echo "Testing encrypted DNS..."
if dig @127.0.0.1 -p 5053 cloudflare.com +short > /dev/null 2>&1; then
    echo "✓ Encrypted DNS proxy is working!"
else
    echo "✗ DNS proxy test failed. Check: systemctl status cloudflared-dns"
    exit 1
fi

echo ""
echo "====================================="
echo "  Encrypted DNS is now running!"
echo "====================================="
echo ""
echo "The DNS proxy is running on 127.0.0.1:5053"
echo ""
echo "To use it system-wide, you have two options:"
echo ""
echo "OPTION 1: Configure /etc/resolv.conf (temporary)"
echo "  echo 'nameserver 127.0.0.1' | sudo tee /etc/resolv.conf"
echo ""
echo "OPTION 2: Configure systemd-resolved (recommended)"
echo "  Edit /etc/systemd/resolved.conf and add:"
echo "    [Resolve]"
echo "    DNS=127.0.0.1:5053"
echo "    DNSStubListener=no"
echo "  Then: sudo systemctl restart systemd-resolved"
echo ""
echo "OPTION 3: Configure your router's DHCP to use this Pi as DNS"
echo "  (This protects all devices on your network)"
echo ""
echo "To verify it's working:"
echo "  dig @127.0.0.1 -p 5053 google.com"
echo ""
echo "To check service status:"
echo "  systemctl status cloudflared-dns"
echo ""

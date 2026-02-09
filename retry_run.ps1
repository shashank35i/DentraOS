$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$adminEmail = "adminretry$rand@example.com"
$pwd = "Pass@1234"
function Post($url, $body, $token=$null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
}
$adminReg = Post "$base/api/auth/register" @{ role="ADMIN"; fullName="Admin Retry"; email=$adminEmail; phone="9000000099"; password=$pwd }
$adminLogin = Post "$base/api/auth/login" @{ role="ADMIN"; email=$adminEmail; password=$pwd }
$adminToken = $adminLogin.token
$retry = Post "$base/api/admin/agents/retry-failed-events" @{} $adminToken
$retry | ConvertTo-Json -Depth 5 | Set-Content -Path "e:\projects_new\Agentic ai DCIS\final version 6.o\retry_result.json" -Encoding UTF8

$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$adminEmail = "adminflow$rand@example.com"
$doctorEmail = "doctorflow$rand@example.com"
$patientEmail = "patientflow$rand@example.com"
$pwd = "Pass@1234"

function Post($url, $body, $token=$null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
}
function Patch($url, $body, $token=$null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  return Invoke-RestMethod -Uri $url -Method Patch -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
}
function Put($url, $body, $token=$null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  return Invoke-RestMethod -Uri $url -Method Put -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
}

$adminReg = Post "$base/api/auth/register" @{ role="ADMIN"; fullName="Admin Flow"; email=$adminEmail; phone="9000000101"; password=$pwd }
$doctorReg = Post "$base/api/auth/register" @{ role="DOCTOR"; fullName="Dr. Flow"; email=$doctorEmail; phone="9000000102"; password=$pwd }
$patientReg = Post "$base/api/auth/register" @{ role="PATIENT"; fullName="Patient Flow"; email=$patientEmail; phone="9000000103"; password=$pwd }

$adminLogin = Post "$base/api/auth/login" @{ role="ADMIN"; email=$adminEmail; password=$pwd }
$doctorLogin = Post "$base/api/auth/login" @{ role="DOCTOR"; email=$doctorEmail; password=$pwd }

$adminToken = $adminLogin.token
$doctorToken = $doctorLogin.token

$inv = Post "$base/api/admin/inventory" @{ itemCode="GAUZE-FLOW-$rand"; name="Sterile Gauze"; category="Consumables"; stock=40; reorderThreshold=10 } $adminToken

$appt = Post "$base/api/admin/appointments" @{ patientUid=$patientReg.uid; doctorUid=$doctorReg.uid; date=(Get-Date).ToString("yyyy-MM-dd"); time="11:00"; type="Checkup"; status="Confirmed" } $adminToken
$apptDbId = $appt.appointment.dbId

$consumables = @{ items=@(@{ itemRef=$inv.item.id; qty=3; unit="pcs" }) }
$cons = Put "$base/api/doctor/appointments/$apptDbId/consumables" $consumables $doctorToken

$complete = Patch "$base/api/admin/appointments/$apptDbId/complete" @{} $adminToken

$result = [PSCustomObject]@{
  admin_uid = $adminReg.uid
  doctor_uid = $doctorReg.uid
  patient_uid = $patientReg.uid
  appointment_db_id = $apptDbId
  inventory_item = $inv.item.id
  consumables_updated = $cons.ok
  appointment_completed = $complete.ok
}
$result | ConvertTo-Json -Depth 5 | Set-Content -Path "e:\projects_new\Agentic ai DCIS\final version 6.o\e2e_flow.json" -Encoding UTF8

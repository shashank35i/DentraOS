$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$adminEmail = "admin$rand@example.com"
$doctorEmail = "doctor$rand@example.com"
$patientEmail = "patient$rand@example.com"
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

try {
  $adminReg = Post "$base/api/auth/register" @{ role="ADMIN"; fullName="Admin User"; email=$adminEmail; phone="9000000001"; password=$pwd }
  $doctorReg = Post "$base/api/auth/register" @{ role="DOCTOR"; fullName="Dr. Rao"; email=$doctorEmail; phone="9000000002"; password=$pwd }
  $patientReg = Post "$base/api/auth/register" @{ role="PATIENT"; fullName="Patient One"; email=$patientEmail; phone="9000000003"; password=$pwd }

  $adminLogin = Post "$base/api/auth/login" @{ role="ADMIN"; email=$adminEmail; password=$pwd }
  $doctorLogin = Post "$base/api/auth/login" @{ role="DOCTOR"; email=$doctorEmail; password=$pwd }
  $patientLogin = Post "$base/api/auth/login" @{ role="PATIENT"; email=$patientEmail; password=$pwd }

  $adminToken = $adminLogin.token
  $doctorToken = $doctorLogin.token
  $patientToken = $patientLogin.token

  $inv = Post "$base/api/admin/inventory" @{ itemCode="GAUZE-$rand"; name="Sterile Gauze"; category="Consumables"; stock=50; reorderThreshold=10 } $adminToken

  $appt = Post "$base/api/admin/appointments" @{ patientUid=$patientReg.uid; doctorUid=$doctorReg.uid; date=(Get-Date).ToString("yyyy-MM-dd"); time="10:30"; type="Checkup"; status="Confirmed" } $adminToken
  $apptDbId = $appt.appointment.dbId

  $consumables = @{ items=@(@{ itemRef=$inv.item.id; qty=5; unit="pcs" }) }
  $cons = Put "$base/api/doctor/appointments/$apptDbId/consumables" $consumables $doctorToken

  $complete = Patch "$base/api/admin/appointments/$apptDbId/complete" @{} $adminToken

  $notifs = Invoke-RestMethod -Uri "$base/api/notifications" -Headers @{ Authorization = "Bearer $adminToken" }

  $result = [PSCustomObject]@{
    admin_uid = $adminReg.uid
    doctor_uid = $doctorReg.uid
    patient_uid = $patientReg.uid
    appointment_db_id = $apptDbId
    inventory_item = $inv.item.id
    consumables_updated = $cons.ok
    appointment_completed = $complete.ok
    notifications_count = $notifs.items.Count
  }
  $result | ConvertTo-Json -Depth 5 | Set-Content -Path "e:\projects_new\Agentic ai DCIS\final version 6.o\e2e_proof.json" -Encoding UTF8
} catch {
  $_ | Out-String | Set-Content -Path "e:\projects_new\Agentic ai DCIS\final version 6.o\e2e_proof_error.txt" -Encoding UTF8
  throw
}

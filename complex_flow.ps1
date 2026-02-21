$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$adminEmail = "admincx$rand@example.com"
$doctorEmail = "doctorcx$rand@example.com"
$patientEmail = "patientcx$rand@example.com"
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

$adminReg = Post "$base/api/auth/register" @{ role="ADMIN"; fullName="Admin Complex"; email=$adminEmail; phone="9000000201"; password=$pwd }
$doctorReg = Post "$base/api/auth/register" @{ role="DOCTOR"; fullName="Dr. Complex"; email=$doctorEmail; phone="9000000202"; password=$pwd }
$patientReg = Post "$base/api/auth/register" @{ role="PATIENT"; fullName="Patient Complex"; email=$patientEmail; phone="9000000203"; password=$pwd }

$adminLogin = Post "$base/api/auth/login" @{ role="ADMIN"; email=$adminEmail; password=$pwd }
$doctorLogin = Post "$base/api/auth/login" @{ role="DOCTOR"; email=$doctorEmail; password=$pwd }

$adminToken = $adminLogin.token
$doctorToken = $doctorLogin.token

# Vendor + low-stock item to trigger PO draft
$vendor = Post "$base/api/admin/vendors" @{ name="Vendor-$rand"; phone="9000000999"; email="vendor$rand@example.com" } $adminToken
$inv = Post "$base/api/admin/inventory" @{ itemCode="GLOVE-CX-$rand"; name="Latex Gloves"; category="Consumables"; stock=12; reorderThreshold=10; vendorId=$vendor.item.id } $adminToken

# Appointment for inventory consumption
$apptInv = Post "$base/api/admin/appointments" @{ patientUid=$patientReg.uid; doctorUid=$doctorReg.uid; date=(Get-Date).ToString("yyyy-MM-dd"); time="12:00"; type="Checkup"; status="Confirmed" } $adminToken
$apptInvId = $apptInv.appointment.dbId
$consumables = @{ items=@(@{ itemRef=$inv.item.id; qty=5; unit="pcs" }) }
$cons = Put "$base/api/doctor/appointments/$apptInvId/consumables" $consumables $doctorToken
$complete = Patch "$base/api/admin/appointments/$apptInvId/complete" @{} $adminToken

# Appointment for no-show -> reschedule suggestion
$apptNoShow = Post "$base/api/admin/appointments" @{ patientUid=$patientReg.uid; doctorUid=$doctorReg.uid; date=(Get-Date).ToString("yyyy-MM-dd"); time="00:00"; type="Checkup"; status="Confirmed" } $adminToken
$apptNoShowId = $apptNoShow.appointment.dbId

# Force monitor tick via DB insert (outbox)
$today = (Get-Date).ToString("yyyy-MM-dd")
$dbContainer = "dentraos-mysql"
if (-not (docker ps --format "{{.Names}}" | Select-String -SimpleMatch $dbContainer)) {
  $fallback = "dental-mysql"
  if (docker ps --format "{{.Names}}" | Select-String -SimpleMatch $fallback) {
    $dbContainer = $fallback
  } else {
    throw "No running MySQL container found (checked: dentraos-mysql, dental-mysql)."
  }
}
& docker exec -i $dbContainer mysql -h 127.0.0.1 -udentra -pdentra_pass dental_clinic -e "UPDATE appointments SET scheduled_date='$today', scheduled_time='00:00:00', status='Confirmed' WHERE id=$apptNoShowId; INSERT INTO agent_events (event_type, payload_json, status, available_at, created_at) VALUES ('AppointmentMonitorTick','{}','NEW',NOW(),NOW());" | Out-Null

Start-Sleep -Seconds 5

$result = [PSCustomObject]@{
  admin_uid = $adminReg.uid
  doctor_uid = $doctorReg.uid
  patient_uid = $patientReg.uid
  vendor_id = $vendor.item.id
  inventory_item = $inv.item.id
  appointment_inventory_id = $apptInvId
  appointment_no_show_id = $apptNoShowId
  consumables_updated = $cons.ok
  appointment_completed = $complete.ok
}
$result | ConvertTo-Json -Depth 6 | Set-Content -Path "e:\projects_new\Agentic ai DCIS\final version 6.o\complex_flow.json" -Encoding UTF8

SET SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE DATABASE IF NOT EXISTS dental_clinic
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE dental_clinic;

SET NAMES utf8mb4;
SET time_zone = '+05:30';

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid VARCHAR(64) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  dob DATE NULL,
  gender VARCHAR(24) NULL,
  address TEXT NULL,
  role ENUM('Admin','Doctor','Assistant','Patient') NOT NULL DEFAULT 'Patient',
  password_hash VARCHAR(255) NULL,
  reset_code VARCHAR(16) NULL,
  reset_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_uid (uid),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  medical_history TEXT NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  billed_override DECIMAL(10,2) NULL,
  paid_override DECIMAL(10,2) NULL,
  balance_override DECIMAL(10,2) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_patient_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clinic_settings (
  id TINYINT NOT NULL,
  clinic_name VARCHAR(120) NULL,
  clinic_phone VARCHAR(40) NULL,
  clinic_email VARCHAR(190) NULL,
  clinic_address TEXT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  working_hours_json LONGTEXT NULL,
  treatment_catalog_json LONGTEXT NULL,
  note_templates_json LONGTEXT NULL,
  ai_preferences_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO clinic_settings (id, timezone) VALUES (1, 'Asia/Kolkata');

CREATE TABLE IF NOT EXISTS role_permissions (
  role ENUM('Admin','Doctor','Assistant','Patient') NOT NULL,
  permissions_json LONGTEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO role_permissions (role, permissions_json) VALUES
  ('Admin', '{"admin_all":true}'),
  ('Doctor', '{"doctor_portal":true,"cases":true,"appointments":true}'),
  ('Assistant', '{"assistant_portal":true,"inventory":true,"appointments":true}'),
  ('Patient', '{"patient_portal":true,"appointments":true,"billing":true}');

CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendors_name (name),
  KEY idx_vendors_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(64) NOT NULL,
  name VARCHAR(190) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'Uncategorized',
  stock INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'Healthy',
  reorder_threshold INT NOT NULL DEFAULT 0,
  expiry_date DATE NULL,
  vendor_id BIGINT UNSIGNED NULL,
  unit_cost DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_item_code (item_code),
  KEY idx_inventory_name (name),
  KEY idx_inventory_category (category),
  KEY idx_inventory_vendor (vendor_id),
  KEY idx_inventory_expiry (expiry_date),
  KEY idx_inventory_stock (stock),
  CONSTRAINT fk_inventory_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_usage_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NULL,
  visit_id BIGINT UNSIGNED NULL,
  item_id BIGINT UNSIGNED NULL,
  item_code VARCHAR(64) NULL,
  qty_used INT NOT NULL DEFAULT 0,
  source ENUM('AUTO','MANUAL','ADJUSTMENT') NOT NULL DEFAULT 'AUTO',
  source_type VARCHAR(64) NULL,
  source_ref_id BIGINT UNSIGNED NULL,
  event_id BIGINT UNSIGNED NULL,
  dedupe_key VARCHAR(190) NULL,
  doctor_id BIGINT UNSIGNED NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_usage_appt (appointment_id),
  KEY idx_usage_visit (visit_id),
  KEY idx_usage_item_id (item_id),
  KEY idx_usage_item_code (item_code),
  KEY idx_usage_event (event_id),
  KEY idx_usage_source_ref (source_ref_id),
  KEY idx_usage_doctor (doctor_id),
  KEY idx_usage_created_at (created_at),
  UNIQUE KEY uq_usage_dedupe (dedupe_key),
  CONSTRAINT fk_usage_item
    FOREIGN KEY (item_id) REFERENCES inventory_items(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_usage_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id BIGINT UNSIGNED NULL,
  status ENUM('DRAFT','REQUESTED','ORDERED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_po_vendor (vendor_id),
  KEY idx_po_status (status),
  KEY idx_po_created (created_at),
  CONSTRAINT fk_po_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(64) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_poi_po (purchase_order_id),
  KEY idx_poi_item (item_code),
  CONSTRAINT fk_poi_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_uid VARCHAR(64) NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  case_type VARCHAR(255) NULL,
  stage ENUM('NEW','IN_TREATMENT','WAITING_ON_PATIENT','READY_TO_CLOSE','CLOSED','BLOCKED') NOT NULL DEFAULT 'NEW',
  pending_stage VARCHAR(32) NULL,
  priority ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  risk_score INT NOT NULL DEFAULT 0,
  next_action VARCHAR(255) NULL,
  next_review_date DATE NULL,
  agent_insights_json LONGTEXT NULL,
  agent_summary TEXT NULL,
  agent_recommendation TEXT NULL,
  approval_required TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cases_uid (case_uid),
  KEY idx_cases_patient (patient_id),
  KEY idx_cases_doctor (doctor_id),
  KEY idx_cases_stage (stage),
  KEY idx_cases_updated_at (updated_at),
  KEY idx_cases_created_at (created_at),
  CONSTRAINT fk_cases_patient
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cases_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_timeline (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  title VARCHAR(200) NULL,
  body TEXT NULL,
  meta_json LONGTEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_case_time (case_id, created_at),
  KEY idx_case_event (case_id, event_type),
  CONSTRAINT fk_case_timeline_case
    FOREIGN KEY (case_id) REFERENCES cases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_case_timeline_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_summaries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  summary TEXT NOT NULL,
  recommendation TEXT NULL,
  confidence INT NOT NULL DEFAULT 50,
  status ENUM('PENDING_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
  created_by_agent TINYINT(1) NOT NULL DEFAULT 1,
  approved_by_user_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_case_status (case_id, status),
  KEY idx_case_created (case_id, created_at),
  CONSTRAINT fk_case_summaries_case
    FOREIGN KEY (case_id) REFERENCES cases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_case_summaries_approver
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  doc_type ENUM('clinical_summary','patient_explanation','consent','post_op') NOT NULL,
  content LONGTEXT NULL,
  status ENUM('DRAFT','READY','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  created_by_agent_event_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_case_doc (case_id, doc_type),
  KEY idx_case_doc_created (created_at),
  CONSTRAINT fk_case_documents_case
    FOREIGN KEY (case_id) REFERENCES cases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(32) NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  before_json LONGTEXT NULL,
  after_json LONGTEXT NULL,
  meta_json LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity_type, entity_id, created_at),
  KEY idx_audit_actor (actor_user_id, created_at),
  CONSTRAINT fk_case_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(120) NULL,
  uploaded_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_case_attachments_case (case_id),
  KEY idx_case_attachments_created (created_at),
  CONSTRAINT fk_case_attachments_case
    FOREIGN KEY (case_id) REFERENCES cases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_case_attachments_uploader
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_uid VARCHAR(64) NOT NULL,
  appointment_code VARCHAR(64) NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  scheduled_end_time TIME NULL,
  predicted_duration_min INT NOT NULL DEFAULT 30,
  type VARCHAR(120) NOT NULL DEFAULT 'General',
  reason TEXT NULL,
  status ENUM('Requested','Confirmed','Checked in','Completed','Cancelled','No-show') NOT NULL DEFAULT 'Requested',
  operatory_id BIGINT UNSIGNED NULL,
  linked_case_id BIGINT UNSIGNED NULL,
  actual_end_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appt_uid (appointment_uid),
  UNIQUE KEY uq_appt_code (appointment_code),
  KEY idx_appt_date_time (scheduled_date, scheduled_time),
  KEY idx_appt_doctor_date (doctor_id, scheduled_date),
  KEY idx_appt_patient_date (patient_id, scheduled_date),
  KEY idx_appt_status (status),
  KEY idx_appt_case (linked_case_id),
  CONSTRAINT fk_appt_patient
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_appt_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_appt_case
    FOREIGN KEY (linked_case_id) REFERENCES cases(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_uid VARCHAR(64) NULL,
  appointment_id BIGINT UNSIGNED NOT NULL,
  linked_case_id BIGINT UNSIGNED NULL,
  patient_id BIGINT UNSIGNED NULL,
  doctor_id BIGINT UNSIGNED NULL,
  visit_date DATE NULL,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visits_uid (visit_uid),
  UNIQUE KEY uq_visits_appt (appointment_id),
  KEY idx_visits_case (linked_case_id),
  KEY idx_visits_patient (patient_id),
  KEY idx_visits_doctor (doctor_id),
  KEY idx_visits_date (visit_date),
  CONSTRAINT fk_visits_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_visits_case
    FOREIGN KEY (linked_case_id) REFERENCES cases(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_visits_patient
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_visits_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visit_procedures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_id BIGINT UNSIGNED NOT NULL,
  procedure_code VARCHAR(64) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vp_visit (visit_id),
  KEY idx_vp_code (procedure_code),
  CONSTRAINT fk_vp_visit
    FOREIGN KEY (visit_id) REFERENCES visits(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visit_consumables (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visit_item (visit_id, inventory_item_id),
  KEY idx_vc_visit (visit_id),
  KEY idx_vc_item (inventory_item_id),
  CONSTRAINT fk_vc_visit
    FOREIGN KEY (visit_id) REFERENCES visits(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vc_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procedure_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(190) NOT NULL,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proc_code (code),
  KEY idx_proc_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procedure_consumables (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  procedure_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proc_item (procedure_id, inventory_item_id),
  KEY idx_pc_proc (procedure_id),
  KEY idx_pc_item (inventory_item_id),
  CONSTRAINT fk_pc_proc
    FOREIGN KEY (procedure_id) REFERENCES procedure_catalog(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pc_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  issue_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  invoice_type ENUM('PROVISIONAL','FINAL') NOT NULL DEFAULT 'FINAL',
  status ENUM('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
  paid_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoice_patient (patient_id),
  KEY idx_invoice_issue_date (issue_date),
  KEY idx_invoice_status (status),
  KEY idx_invoice_paid_date (paid_date),
  KEY idx_invoice_appt (appointment_id),
  CONSTRAINT fk_invoice_patient
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_invoice_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('PROCEDURE','MATERIAL','APPARATUS') NOT NULL DEFAULT 'PROCEDURE',
  code VARCHAR(64) NOT NULL,
  description VARCHAR(255) NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice (invoice_id),
  KEY idx_invoice_items_code (code),
  KEY idx_invoice_items_type (item_type),
  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_reschedule_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(64) NOT NULL DEFAULT 'NO_SHOW',
  suggested_slots_json LONGTEXT NULL,
  status ENUM('PENDING','APPLIED','DISMISSED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ars_appt (appointment_id),
  KEY idx_ars_status (status),
  KEY idx_ars_created (created_at),
  CONSTRAINT fk_ars_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_recommendations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NULL,
  doctor_id BIGINT UNSIGNED NULL,
  recommended_start DATETIME NOT NULL,
  recommended_end DATETIME NULL,
  reason VARCHAR(255) NULL,
  confidence INT NOT NULL DEFAULT 50,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_rec_doctor (doctor_id, created_at),
  KEY idx_appt_rec_appt (appointment_id),
  CONSTRAINT fk_appt_reco_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_appt_reco_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reminder_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  channel ENUM('IN_APP','EMAIL','SMS','WHATSAPP','CALL') NOT NULL DEFAULT 'IN_APP',
  status ENUM('QUEUED','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reminder_appt (appointment_id, scheduled_at),
  KEY idx_reminder_user (user_id, status),
  KEY idx_reminder_status (status, scheduled_at),
  CONSTRAINT fk_reminder_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reminder_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revenue_insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  as_of_date DATE NOT NULL,
  raw_json LONGTEXT NULL,
  insight_type VARCHAR(64) NULL,
  range_label VARCHAR(16) NULL,
  forecast_json LONGTEXT NULL,
  kpi_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rev_as_of_type (as_of_date, insight_type, range_label),
  KEY idx_rev_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_anomalies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(64) NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  procedure_code VARCHAR(64) NULL,
  anomaly_type VARCHAR(64) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  score DECIMAL(6,2) NOT NULL DEFAULT 0,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_anomaly_item (item_code, created_at),
  KEY idx_inventory_anomaly_doctor (doctor_id, created_at),
  CONSTRAINT fk_inventory_anomaly_doctor
    FOREIGN KEY (doctor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revenue_anomalies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NULL,
  appointment_id BIGINT UNSIGNED NULL,
  anomaly_type VARCHAR(64) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  estimated_loss DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_revenue_anomaly_invoice (invoice_id, created_at),
  KEY idx_revenue_anomaly_appt (appointment_id, created_at),
  CONSTRAINT fk_revenue_anomaly_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_revenue_anomaly_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  gateway VARCHAR(64) NULL,
  transaction_id VARCHAR(128) NULL,
  status ENUM('INITIATED','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'INITIATED',
  payment_method VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pay_invoice (invoice_id),
  KEY idx_pay_patient (patient_id),
  KEY idx_pay_created (created_at),
  CONSTRAINT fk_pay_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pay_patient
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  note TEXT NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_appt (appointment_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_appt
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL,
  payload_json LONGTEXT NULL,
  status ENUM('NEW','PROCESSING','DONE','FAILED','DEAD') NOT NULL DEFAULT 'NEW',
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by VARCHAR(64) NULL,
  locked_until DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 7,
  priority INT NOT NULL DEFAULT 100,
  last_error TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status_available (status, available_at),
  KEY idx_locked_until (locked_until),
  KEY idx_event_type (event_type),
  KEY idx_created_at (created_at),
  KEY idx_agent_events_created_by (created_by_user_id),
  CONSTRAINT fk_agent_events_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_locks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lock_key VARCHAR(190) NOT NULL,
  locked_by VARCHAR(64) NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lock_key (lock_key),
  KEY idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  user_role VARCHAR(16) NULL,
  channel ENUM('IN_APP','EMAIL','SMS','WHATSAPP','CALL') NOT NULL DEFAULT 'IN_APP',
  type VARCHAR(64) NULL,
  title VARCHAR(200) NULL,
  message TEXT NOT NULL,
  status ENUM('NEW','PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'NEW',
  scheduled_at DATETIME NULL,
  read_at DATETIME NULL,
  priority INT NOT NULL DEFAULT 100,
  related_entity_type VARCHAR(40) NULL,
  related_entity_id BIGINT NULL,
  template_key VARCHAR(64) NULL,
  template_vars_json LONGTEXT NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id),
  KEY idx_role (user_role),
  KEY idx_status (status),
  KEY idx_created_at (created_at),
  KEY idx_scheduled_at (scheduled_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO procedure_catalog (code, name, default_price) VALUES
  ('GENERAL', 'General consultation', 0.00),
  ('SCALING', 'Scaling', 0.00),
  ('FILLING', 'Filling', 0.00),
  ('ROOT_CANAL', 'Root canal', 0.00),
  ('EXTRACTION', 'Extraction', 0.00),
  ('IMPLANT', 'Implant', 0.00);

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col   VARCHAR(64),
  IN p_def   TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_table
        AND COLUMN_NAME = p_col
    ) THEN
      SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END IF;
END$$

CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_sql   TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_table
        AND INDEX_NAME = p_index
    ) THEN
      SET @sql = p_sql;
      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END IF;
END$$

DELIMITER ;

CALL add_col_if_missing('visits', 'linked_case_id', 'BIGINT UNSIGNED NULL AFTER appointment_id');

CALL add_index_if_missing(
  'visits',
  'idx_visits_case',
  'ALTER TABLE visits ADD KEY idx_visits_case (linked_case_id)'
);

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

INSERT INTO agent_events (event_type, payload_json, status, available_at, created_at)
VALUES ('AppointmentMonitorTick', '{}', 'NEW', NOW(), NOW());

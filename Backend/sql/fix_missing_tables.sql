-- Fix missing tables for Dental Clinic AI (Safe, Additive)

-- 1. Patient Profiles (Medical History, etc.)
CREATE TABLE IF NOT EXISTS patient_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  medical_history TEXT NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pp_user (user_id),
  CONSTRAINT fk_pp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 2. Clinic Settings (Global Config)
CREATE TABLE IF NOT EXISTS clinic_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clinic_name VARCHAR(120) NULL,
  clinic_phone VARCHAR(40) NULL,
  clinic_email VARCHAR(120) NULL,
  clinic_address VARCHAR(255) NULL,
  timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
  working_hours_json JSON NULL,
  treatment_catalog_json JSON NULL,
  note_templates_json JSON NULL,
  ai_preferences_json JSON NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Seed default clinic settings (to avoid backend crashes)
INSERT IGNORE INTO clinic_settings (id, clinic_name, timezone)
VALUES (1, 'My Dental Clinic', 'Asia/Kolkata');

-- 3. Role Permissions (RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(64) NOT NULL,
  permissions_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role)
) ENGINE=InnoDB;

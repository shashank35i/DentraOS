-- Revenue Agent analytics + insights schema updates
-- Safe, additive migrations only.

CREATE TABLE IF NOT EXISTS revenue_analytics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_date DATE NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  procedure_code VARCHAR(64) NULL,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  appointment_count INT NOT NULL DEFAULT 0,
  chair_minutes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rev_daily (usage_date, doctor_id, procedure_code),
  KEY idx_rev_date (usage_date),
  KEY idx_rev_doctor (doctor_id),
  KEY idx_rev_proc (procedure_code)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER $$
CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col   VARCHAR(64),
  IN p_def   TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_col, ' ', p_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- revenue_insights: add fields required by RevenueAgent
CALL add_col_if_missing('revenue_insights', 'insight_type', "VARCHAR(64) NULL AFTER as_of_date");
CALL add_col_if_missing('revenue_insights', 'range_label', "VARCHAR(16) NULL AFTER insight_type");
CALL add_col_if_missing('revenue_insights', 'forecast_json', "LONGTEXT NULL AFTER raw_json");
CALL add_col_if_missing('revenue_insights', 'kpi_json', "LONGTEXT NULL AFTER forecast_json");

-- appointments: clinic/branch support (optional analytics)
CALL add_col_if_missing('appointments', 'clinic_id', 'BIGINT UNSIGNED NULL AFTER operatory_id');

-- invoices: claim/insurance tracking
CALL add_col_if_missing('invoices', 'claim_status', "VARCHAR(32) NULL AFTER status");
CALL add_col_if_missing('invoices', 'insurance_status', "VARCHAR(32) NULL AFTER claim_status");
CALL add_col_if_missing('invoices', 'claim_submitted_at', "DATETIME NULL AFTER insurance_status");
CALL add_col_if_missing('invoices', 'claim_rejected_at', "DATETIME NULL AFTER claim_submitted_at");
CALL add_col_if_missing('invoices', 'claim_denied_at', "DATETIME NULL AFTER claim_rejected_at");

-- Replace single-day uniqueness with (as_of_date, insight_type, range_label)
SET @has_uq_as_of := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='revenue_insights'
    AND INDEX_NAME='uq_rev_as_of'
);

SET @has_uq_as_of_type := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='revenue_insights'
    AND INDEX_NAME='uq_rev_as_of_type'
);

SET @sql_drop := IF(@has_uq_as_of>0, 'ALTER TABLE revenue_insights DROP INDEX uq_rev_as_of', 'SELECT 1');
PREPARE r1 FROM @sql_drop; EXECUTE r1; DEALLOCATE PREPARE r1;

SET @sql_add := IF(@has_uq_as_of_type=0,
  'ALTER TABLE revenue_insights ADD UNIQUE KEY uq_rev_as_of_type (as_of_date, insight_type, range_label)',
  'SELECT 1'
);
PREPARE r2 FROM @sql_add; EXECUTE r2; DEALLOCATE PREPARE r2;

DROP PROCEDURE IF EXISTS add_col_if_missing;

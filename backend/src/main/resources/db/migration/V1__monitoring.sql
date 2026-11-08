CREATE TABLE device (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 version BIGINT NOT NULL DEFAULT 0,
 site_id VARCHAR(100) NOT NULL, mac VARCHAR(17) NOT NULL,
 device_number VARCHAR(100) NOT NULL, name VARCHAR(200) NOT NULL, location VARCHAR(300) NOT NULL,
 previous_state VARCHAR(20) NOT NULL, current_state VARCHAR(20) NOT NULL,
 last_status_change TIMESTAMP(6) NOT NULL,
 last_observed TIMESTAMP(6),
 state_revision BIGINT NOT NULL DEFAULT 0,
 CONSTRAINT device_mac_site UNIQUE(site_id, mac),
 CONSTRAINT device_number_site UNIQUE(site_id, device_number)
);
CREATE TABLE status_change (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 device_id BIGINT NOT NULL,
 previous_state VARCHAR(20) NOT NULL, current_state VARCHAR(20) NOT NULL,
 changed_at TIMESTAMP(6) NOT NULL,
 CONSTRAINT status_change_device FOREIGN KEY(device_id) REFERENCES device(id)
);
CREATE TABLE alert_rule (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 device_id BIGINT NOT NULL,
 kind VARCHAR(20) NOT NULL, method VARCHAR(10) NOT NULL, trigger_type VARCHAR(20) NOT NULL,
 target_state VARCHAR(20) NOT NULL, minimum_seconds BIGINT NOT NULL,
 repeat_seconds BIGINT NOT NULL, maximum_count INTEGER NOT NULL,
 start_time TIME NOT NULL, end_time TIME NOT NULL, zone_id VARCHAR(100) NOT NULL,
 override_mac VARCHAR(17), recipients_json TEXT NOT NULL,
 CONSTRAINT alert_rule_device FOREIGN KEY(device_id) REFERENCES device(id)
);
CREATE TABLE notification (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 device_id BIGINT NOT NULL, rule_id BIGINT NOT NULL,
 kind VARCHAR(20) NOT NULL, state_revision BIGINT NOT NULL,
 sequence_number INTEGER NOT NULL, method VARCHAR(10) NOT NULL, recipients_json TEXT NOT NULL,
 message VARCHAR(2000) NOT NULL, created_at TIMESTAMP(6) NOT NULL,
 delivered_at TIMESTAMP(6), delivery_state VARCHAR(20) NOT NULL,
 attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt TIMESTAMP(6),
 CONSTRAINT notification_once UNIQUE(rule_id, state_revision, sequence_number),
 CONSTRAINT notification_device FOREIGN KEY(device_id) REFERENCES device(id),
 CONSTRAINT notification_rule FOREIGN KEY(rule_id) REFERENCES alert_rule(id)
);

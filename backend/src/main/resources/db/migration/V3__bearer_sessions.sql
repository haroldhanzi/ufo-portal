ALTER TABLE app_user ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
CREATE TABLE user_session (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 auth_version BIGINT NOT NULL,
 expires_at TIMESTAMP(6) NOT NULL,
 revoked BOOLEAN NOT NULL DEFAULT FALSE,
 omada_access_token TEXT,
 omada_expires_at TIMESTAMP(6),
 CONSTRAINT fk_user_session_account FOREIGN KEY(user_id) REFERENCES app_user(id)
);

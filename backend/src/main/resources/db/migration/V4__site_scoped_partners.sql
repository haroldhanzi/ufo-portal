CREATE TABLE omada_site (
 id VARCHAR(100) PRIMARY KEY,
 name VARCHAR(200) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE app_user ADD COLUMN site_id VARCHAR(100);
ALTER TABLE app_user ADD COLUMN site_name VARCHAR(200);
ALTER TABLE app_user ADD CONSTRAINT fk_partner_site FOREIGN KEY(site_id) REFERENCES omada_site(id);
UPDATE app_user SET role='SUPER_ADMIN', auth_version=auth_version+1 WHERE role='ADMIN';
UPDATE app_user SET role='PORTAL_PARTNER', enabled=FALSE, auth_version=auth_version+1 WHERE role IN ('OPERATOR','VIEWER');

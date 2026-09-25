CREATE TABLE neighborhood(
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    sea_access BOOLEAN NOT NULL
);
INSERT INTO neighborhood (code, name, sea_access) VALUES
('A', 'Apex', FALSE),
('E', 'Echo', TRUE),
('W', 'Warden', FALSE),
('X', 'Xeno', TRUE),
('Z', 'Zion', TRUE);
CREATE TABLE neighborhood_resources (
    district_code VARCHAR(10) REFERENCES neighborhood(code),
    resource_name VARCHAR(50),
    initial_quantity INT NOT NULL,
    min_retention INT NOT NULL,
    current_quantity INT NOT NULL,
    PRIMARY KEY (district_code, resource_name)
);
INSERT INTO neighborhood_resources (district_code, resource_name, initial_quantity, min_retention, current_quantity) VALUES
('A', 'Medical personnel', 12, 4, 12),
('A', 'Rescue teams', 4, 2, 4),
('A', 'Transport vehicles', 6, 2, 6),
('A', 'Emergency shelters', 8, 3, 8),
('A', 'Food & water supplies', 5, 2, 5),
('A', 'Communication equipment', 3, 1, 3),
('A', 'Power generators', 7, 3, 7),
('A', 'Engineering crews', 2, 1, 2),
('A', 'Security units', 9, 3, 9),
('A', 'Hazmat equipment', 3, 1, 3),

('E', 'Medical personnel', 5, 2, 5),
('E', 'Rescue teams', 9, 3, 9),
('E', 'Transport vehicles', 3, 1, 3),
('E', 'Emergency shelters', 6, 2, 6),
('E', 'Food & water supplies', 8, 3, 8),
('E', 'Communication equipment', 7, 3, 7),
('E', 'Power generators', 2, 1, 2),
('E', 'Engineering crews', 6, 2, 6),
('E', 'Security units', 4, 2, 4),
('E', 'Hazmat equipment', 5, 2, 5),

('W', 'Medical personnel', 8, 3, 8),
('W', 'Rescue teams', 3, 1, 3),
('W', 'Transport vehicles', 10, 3, 10),
('W', 'Emergency shelters', 4, 2, 4),
('W', 'Food & water supplies', 6, 2, 6),
('W', 'Communication equipment', 5, 2, 5),
('W', 'Power generators', 9, 3, 9),
('W', 'Engineering crews', 7, 3, 7),
('W', 'Security units', 2, 1, 2),
('W', 'Hazmat equipment', 4, 2, 4),

('X', 'Medical personnel', 3, 1, 3),
('X', 'Rescue teams', 6, 2, 6),
('X', 'Transport vehicles', 4, 2, 4),
('X', 'Emergency shelters', 10, 3, 10),
('X', 'Food & water supplies', 7, 3, 7),
('X', 'Communication equipment', 8, 3, 8),
('X', 'Power generators', 5, 2, 5),
('X', 'Engineering crews', 4, 2, 4),
('X', 'Security units', 6, 2, 6),
('X', 'Hazmat equipment', 2, 1, 2),

('Z', 'Medical personnel', 7, 3, 7),
('Z', 'Rescue teams', 5, 2, 5),
('Z', 'Transport vehicles', 7, 3, 7),
('Z', 'Emergency shelters', 2, 1, 2),
('Z', 'Food & water supplies', 9, 3, 9),
('Z', 'Communication equipment', 4, 2, 4),
('Z', 'Power generators', 6, 2, 6),
('Z', 'Engineering crews', 8, 3, 8),
('Z', 'Security units', 3, 1, 3),
('Z', 'Hazmat equipment', 10, 3, 10);

CREATE TABLE neighborhood_connections (
    neighborhood_code_1 VARCHAR(10) REFERENCES neighborhood(code),
    neighborhood_code_2 VARCHAR(10) REFERENCES neighborhood(code),
    blocked_until TIMESTAMP,
    PRIMARY KEY (neighborhood_code_1, neighborhood_code_2)
);
INSERT INTO neighborhood_connections (neighborhood_code_1, neighborhood_code_2) VALUES
('A', 'E'), ('E', 'A'),
('A', 'W'), ('W', 'A'),
('A', 'X'), ('X', 'A'),
('E', 'X'), ('X', 'E'),
('W', 'X'), ('X', 'W'),
('W', 'Z'), ('Z', 'W'),
('X', 'Z'), ('Z', 'X');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('QC', 'LC', 'CD')),
    neighborhood_code VARCHAR(10) REFERENCES neighborhood(code)
);

CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    resource_name VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    source_code VARCHAR(10) NOT NULL REFERENCES neighborhood(code),
    target_code VARCHAR(10) NOT NULL REFERENCES neighborhood(code),
    intermediary_code VARCHAR(10) REFERENCES neighborhood(code),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_transit', 'done', 'rejected')),
    arrives_at TIMESTAMP,
    requested_by INT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE disasters (
    id SERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    district_code VARCHAR(10) NOT NULL REFERENCES neighborhood(code),
    losses INT NOT NULL,
    happened_at TIMESTAMP NOT NULL DEFAULT now()
);


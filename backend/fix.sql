CREATE TABLE IF NOT EXISTS game_state (
    key VARCHAR(50) PRIMARY KEY,
    value INT NOT NULL
);

INSERT INTO game_state (key, value) 
VALUES ('crisis_level', 1) 
ON CONFLICT (key) DO NOTHING;
CREATE TABLE IF NOT EXISTS ticks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(10),
  price DECIMAL(10, 2),
  volume INT,
  change_percent DECIMAL(5, 2),
  timestamp BIGINT
);

CREATE INDEX idx_symbol_time ON ticks(symbol, timestamp);

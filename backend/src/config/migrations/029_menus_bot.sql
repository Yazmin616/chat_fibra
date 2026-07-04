CREATE TABLE IF NOT EXISTS menus_bot (
  id SERIAL PRIMARY KEY,
  empresa_id VARCHAR(50) NOT NULL,
  menu_id VARCHAR(50) NOT NULL,
  button_id VARCHAR(50) NOT NULL,
  texto VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, menu_id, button_id)
);

CREATE OR REPLACE FUNCTION update_menus_bot_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_menus_bot_updated_at ON menus_bot;
CREATE TRIGGER update_menus_bot_updated_at
BEFORE UPDATE ON menus_bot
FOR EACH ROW
EXECUTE PROCEDURE update_menus_bot_updated_at_column();

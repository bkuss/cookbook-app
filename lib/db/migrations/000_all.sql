-- Full schema for Familienrezepte database
-- This is the canonical schema file — keep it in sync with the current DB structure.

-- App settings (stores hashed PIN)
CREATE TABLE recipes_app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipes table
CREATE TABLE recipes_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    servings INTEGER DEFAULT 4,
    image_data TEXT,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients table (normalized)
CREATE TABLE recipes_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes_recipes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50),
    unit VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE recipes_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT 'gray',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for recipe-tag many-to-many relationship
CREATE TABLE recipes_recipe_tags (
    recipe_id UUID NOT NULL REFERENCES recipes_recipes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES recipes_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (recipe_id, tag_id)
);

-- Indexes
CREATE INDEX idx_recipes_recipes_title ON recipes_recipes USING gin(to_tsvector('german', title));
CREATE INDEX idx_recipes_recipes_created_at ON recipes_recipes(created_at DESC);
CREATE INDEX idx_recipes_ingredients_recipe_id ON recipes_ingredients(recipe_id);
CREATE INDEX idx_recipes_tags_name ON recipes_tags(name);
CREATE INDEX idx_recipes_recipe_tags_recipe_id ON recipes_recipe_tags(recipe_id);
CREATE INDEX idx_recipes_recipe_tags_tag_id ON recipes_recipe_tags(tag_id);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION recipes_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_recipes_recipes_updated_at
    BEFORE UPDATE ON recipes_recipes
    FOR EACH ROW EXECUTE FUNCTION recipes_update_updated_at_column();

CREATE TRIGGER update_recipes_settings_updated_at
    BEFORE UPDATE ON recipes_app_settings
    FOR EACH ROW EXECUTE FUNCTION recipes_update_updated_at_column();

CREATE TRIGGER update_recipes_tags_updated_at
    BEFORE UPDATE ON recipes_tags
    FOR EACH ROW EXECUTE FUNCTION recipes_update_updated_at_column();

-- Seed data: default tags
INSERT INTO recipes_tags (name, color) VALUES
    ('Vegetarisch', 'green'),
    ('Vegan', 'emerald'),
    ('Schnell', 'yellow'),
    ('Dessert', 'pink'),
    ('Hauptgericht', 'blue'),
    ('Vorspeise', 'purple'),
    ('Frühstück', 'orange'),
    ('Backen', 'amber'),
    ('Italienisch', 'red'),
    ('Asiatisch', 'cyan');

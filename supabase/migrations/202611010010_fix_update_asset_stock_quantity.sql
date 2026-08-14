-- Fix update_asset_stock() to update assets.quantity.
-- assets has no current_stock or updated_at columns per schema.sql,
-- so the previous body errored whenever inventory adjustments ran.
CREATE OR REPLACE FUNCTION update_asset_stock(
    p_asset_id UUID,
    p_change NUMERIC
) RETURNS VOID AS $$
BEGIN
    UPDATE assets
    SET quantity = COALESCE(quantity, 0) + p_change
    WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;
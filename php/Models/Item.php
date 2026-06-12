<?php
/**
 * DB Model for Item Management in Albion Craft Calculator
 */

require_once __DIR__ . '/../config.php';

class ItemModel {
    private PDO $db;

    public function __construct() {
        $this->db = DatabaseConnection::getConnection();
    }

    public function getAll(): array {
        $stmt = $this->db->query("SELECT * FROM items ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public function getById(string $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $row : null;
    }

    public function create(string $id, string $name, string $category, string $parent_tree, bool $is_artifact, int $craft_fame, int $nutrition_cost): bool {
        $stmt = $this->db->prepare("INSERT INTO items (id, name, category, parent_tree, is_artifact, craft_fame, nutrition_cost) VALUES (?, ?, ?, ?, ?, ?, ?)");
        return $stmt->execute([
            $id,
            $name,
            $category,
            $parent_tree,
            $is_artifact ? 1 : 0,
            $craft_fame,
            $nutrition_cost
        ]);
    }

    public function update(string $id, string $name, string $category, string $parent_tree, bool $is_artifact, int $craft_fame, int $nutrition_cost): bool {
        $stmt = $this->db->prepare("UPDATE items SET name = ?, category = ?, parent_tree = ?, is_artifact = ?, craft_fame = ?, nutrition_cost = ? WHERE id = ?");
        return $stmt->execute([
            $name,
            $category,
            $parent_tree,
            $is_artifact ? 1 : 0,
            $craft_fame,
            $nutrition_cost,
            $id
        ]);
    }

    public function delete(string $id): bool {
        $stmt = $this->db->prepare("DELETE FROM items WHERE id = ?");
        return $stmt->execute([$id]);
    }
}

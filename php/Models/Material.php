<?php
/**
 * DB Model for Material Management in Albion Craft Calculator
 */

require_once __DIR__ . '/../config.php';

class MaterialModel {
    private PDO $db;

    public function __construct() {
        $this->db = DatabaseConnection::getConnection();
    }

    public function getAll(): array {
        $stmt = $this->db->query("SELECT * FROM materials ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public function getById(string $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM materials WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $row : null;
    }

    public function create(string $id, string $name, string $type, ?string $image_url): bool {
        // Start transactions to guarantee atomic pricing entry along with material creation
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("INSERT INTO materials (id, name, type, image_url) VALUES (?, ?, ?, ?)");
            $stmt->execute([$id, $name, $type, $image_url]);

            $stmtPrice = $this->db->prepare("INSERT INTO daily_prices (material_id, price) VALUES (?, 0.00)");
            $stmtPrice->execute([$id]);

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function update(string $id, string $name, string $type, ?string $image_url): bool {
        $stmt = $this->db->prepare("UPDATE materials SET name = ?, type = ?, image_url = ? WHERE id = ?");
        return $stmt->execute([$name, $type, $image_url, $id]);
    }

    public function delete(string $id): bool {
        $stmt = $this->db->prepare("DELETE FROM materials WHERE id = ?");
        return $stmt->execute([$id]);
    }
}

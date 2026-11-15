"""Minimal integration smoke tests for LearnHub's public API and access controls.

Run from the project root:
    python -m unittest discover -s server -p "test_*.py" -v

Tests run against the configured development database; avoid pointing
DATABASE_URL to a live/production database.
"""
import unittest

from app import app


class LearnHubSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_csrf_token(self):
        response = self.client.get("/api/csrf")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json().get("csrf"))

    def test_public_course_catalog(self):
        response = self.client.get("/api/courses")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.get_json().get("courses"), list)

    def test_dashboard_requires_login(self):
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 401)

    def test_mutation_requires_csrf(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "not-a-real-password"},
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()

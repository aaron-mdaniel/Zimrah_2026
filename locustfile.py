import random
from locust import HttpUser, task, between


class ZimrahPublicUser(HttpUser):
    """
    Simulates realistic public visitors accessing ZIMRAH 2026 website and APIs:
    - Checking the homepage and live tracker
    - Browsing competition scorecards
    - Filtering by category and division
    - Searching by chest number, contestant, or church
    - Checking Church & Individual Championship leaderboards
    - Periodic polling to simulate the 20-25s live ticker
    """
    wait_time = between(1, 3)

    EVENT_CODES = [f"EV{i:02d}" for i in range(1, 35)]
    SEARCH_QUERIES = ["001", "002", "010", "Adoor", "CSI", "Solo", "Choir", "വിഭാഗം", "Sarah", "John"]

    @task(5)
    def view_homepage(self):
        """Simulates landing on the homepage."""
        self.client.get("/", name="[Page] Homepage")

    @task(4)
    def browse_results_directory(self):
        """Simulates browsing all 34 competition results."""
        self.client.get("/results/", name="[Page] Results Directory")

    @task(3)
    def filter_results_by_division(self):
        """Simulates filtering results by division."""
        div = random.randint(1, 4)
        self.client.get(f"/results/?division={div}", name="[Page] Filter by Division")

    @task(4)
    def view_specific_scorecard(self):
        """Simulates viewing a specific event result page."""
        code = random.choice(self.EVENT_CODES)
        self.client.get(f"/results/{code}/", name="[Page] Event Scorecard")

    @task(3)
    def view_church_championship(self):
        """Simulates checking church rankings."""
        self.client.get("/championship/church/", name="[Page] Church Championship")

    @task(3)
    def view_individual_championship(self):
        """Simulates checking individual contestants leaderboard."""
        cat = random.choice(["", "JUNIOR", "SENIOR"])
        url = f"/championship/individual/?category={cat}" if cat else "/championship/individual/"
        self.client.get(url, name="[Page] Individual Championship")

    @task(3)
    def perform_search(self):
        """Simulates searching by chest number or participant."""
        query = random.choice(self.SEARCH_QUERIES)
        self.client.get(f"/search/?q={query}", name="[Page] Global Search")

    @task(6)
    def poll_live_summary_api(self):
        """Simulates client-side real-time polling ticker."""
        self.client.get("/api/v1/live/summary/", name="[API] Live Summary Feed")

    @task(2)
    def fetch_results_api(self):
        """Simulates mobile app querying published results list."""
        self.client.get("/api/v1/results/", name="[API] Published Results List")

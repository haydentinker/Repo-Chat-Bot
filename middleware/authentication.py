from flask import request, redirect, url_for, session

def set_up_auth_middleware(app, users_collection):
    @app.before_request
    def check_authentication():
        public_endpoints = ['github.login', 'github.authorized', 'static']
        
        if request.endpoint in public_endpoints or not request.endpoint:
            return

        user_id = session.get("user_id")
        
        if not user_id:
            return redirect(url_for("github.login"))
        
        user = users_collection.find_one({"github_id": user_id})

        if not user:
            session.clear()
            return redirect(url_for("github.login"))

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny

schema_view = SpectacularAPIView.as_view(
    authentication_classes=[],
    permission_classes=[AllowAny],
)
swagger_view = SpectacularSwaggerView.as_view(
    url_name="schema",
    authentication_classes=[],
    permission_classes=[AllowAny],
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", schema_view, name="schema"),
    path("api/docs/", swagger_view, name="swagger-ui"),
    path("api/", include("api.urls")),
]

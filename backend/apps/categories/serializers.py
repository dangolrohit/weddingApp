from rest_framework import serializers
from .models import Category

class CategorySerializer(serializers.ModelSerializer):
    client_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'sort_order', 'is_visible', 'created_at', 'client_count')
        read_only_fields = ('id', 'created_at', 'client_count')

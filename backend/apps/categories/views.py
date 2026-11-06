from django.db.models import Count, Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Category
from .serializers import CategorySerializer

class CategoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = Category.objects.annotate(
            client_count=Count('clients', filter=Q(clients__deleted_at__isnull=True))
        ).order_order = ['sort_order', 'name']
        queryset = Category.objects.annotate(
            client_count=Count('clients', filter=Q(clients__deleted_at__isnull=True))
        ).order_by('sort_order', 'name')
        serializer = CategorySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class CategoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Category.objects.annotate(
                client_count=Count('clients', filter=Q(clients__deleted_at__isnull=True))
            ).get(pk=pk)
        except (Category.DoesNotExist, ValueError):
            return None

    def get(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if category.client_count > 0:
            return Response(
                {'detail': f'Cannot delete category "{category.name}" because {category.client_count} client(s) are assigned to it. Reassign or delete them first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        category.delete()
        return Response({'detail': 'Category deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


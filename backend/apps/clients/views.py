from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Client
from .serializers import ClientListSerializer, ClientDetailSerializer, ClientCreateSerializer
from apps.core.pagination import StandardResultsSetPagination
from apps.core.utils import generate_passkey

class ClientListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        queryset = Client.objects.select_related('category').all()

        # Trash filter: default to non-deleted items unless ?trash=true
        show_trash = request.query_params.get('trash', 'false').lower() in ('true', '1')
        if show_trash:
            queryset = queryset.filter(deleted_at__isnull=False)
        else:
            queryset = queryset.filter(deleted_at__isnull=True)

        # Search filter (groom or bride names)
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(groom_name__icontains=search) | Q(bride_name__icontains=search)
            )

        # Category filter
        category = request.query_params.get('category', '').strip()
        if category:
            queryset = queryset.filter(
                Q(category_id=category) | Q(category__slug=category)
            )

        # Status filter
        client_status = request.query_params.get('status', '').strip()
        if client_status in ('draft', 'published', 'archived'):
            queryset = queryset.filter(status=client_status)

        # Event date filter
        date_from = request.query_params.get('date_from', '').strip()
        if date_from:
            queryset = queryset.filter(event_date__gte=date_from)
        date_to = request.query_params.get('date_to', '').strip()
        if date_to:
            queryset = queryset.filter(event_date__lte=date_to)

        # Sorting
        ordering = request.query_params.get('ordering', '-created_at')
        valid_order_fields = [
            'created_at', '-created_at',
            'event_date', '-event_date',
            'groom_name', '-groom_name',
            'photo_count', '-photo_count',
            'storage_bytes', '-storage_bytes'
        ]
        if ordering in valid_order_fields:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-created_at')

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ClientListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = ClientCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        client = serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class ClientDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Client.objects.select_related('category').get(pk=pk)
        except (Client.DoesNotExist, ValueError):
            return None

    def get(self, request, pk):
        client = self.get_object(pk)
        if not client:
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ClientDetailSerializer(client)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        client = self.get_object(pk)
        if not client:
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ClientDetailSerializer(client, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        client = self.get_object(pk)
        if not client:
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Soft delete to trash
        client.soft_delete()
        return Response({'detail': 'Client moved to trash.'}, status=status.HTTP_200_OK)

class ClientPasskeyRegenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            client = Client.objects.get(pk=pk)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        raw_passkey = generate_passkey()
        client.set_passkey(raw_passkey)
        client.save(update_fields=['passkey_hash', 'updated_at'])

        return Response({
            'raw_passkey': raw_passkey,
            'detail': 'Passkey successfully regenerated.'
        }, status=status.HTTP_200_OK)

class ClientRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            client = Client.objects.get(pk=pk)
        except (Client.DoesNotExist, ValueError):
            return Response({'detail': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

        client.restore()
        return Response({'detail': 'Client restored successfully.'}, status=status.HTTP_200_OK)

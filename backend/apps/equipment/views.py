from django.db.models import Sum, Count, Q
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Equipment
from .serializers import EquipmentSerializer

class EquipmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EquipmentSerializer

    def get_queryset(self):
        qs = Equipment.objects.select_related('created_by').all()
        category = self.request.query_params.get('category')
        status_val = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if category:
            qs = qs.filter(category=category)
        if status_val:
            qs = qs.filter(status=status_val)
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(brand__icontains=search) |
                Q(model_number__icontains=search) |
                Q(serial_number__icontains=search) |
                Q(assigned_to__icontains=search)
            )
        return qs.order_by('category', 'name')

class EquipmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EquipmentSerializer
    queryset = Equipment.objects.select_related('created_by').all()

class EquipmentSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        total_count = Equipment.objects.count()
        total_value = Equipment.objects.aggregate(total=Sum('purchase_price'))['total'] or 0.0

        available_count = Equipment.objects.filter(status='available').count()
        in_use_count = Equipment.objects.filter(status='in_use').count()
        maintenance_count = Equipment.objects.filter(status='maintenance').count()
        retired_count = Equipment.objects.filter(status='retired').count()

        by_cat_qs = Equipment.objects.values('category').annotate(count=Count('id'))
        by_category = {item['category']: item['count'] for item in by_cat_qs}

        return Response({
            'total_count': total_count,
            'total_value': float(total_value),
            'available_count': available_count,
            'in_use_count': in_use_count,
            'maintenance_count': maintenance_count,
            'retired_count': retired_count,
            'by_category': by_category,
        })


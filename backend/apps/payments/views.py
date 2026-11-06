from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Payment
from .serializers import PaymentSerializer
from apps.clients.models import Client

class PaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('client', 'recorded_by').all()
        client_id = self.request.query_params.get('client') or self.request.query_params.get('client_id')
        method = self.request.query_params.get('method')
        payment_type = self.request.query_params.get('payment_type')
        search = self.request.query_params.get('search')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if client_id:
            qs = qs.filter(client_id=client_id)
        if method:
            qs = qs.filter(method=method)
        if payment_type:
            qs = qs.filter(payment_type=payment_type)
        if start_date:
            qs = qs.filter(payment_date__gte=start_date)
        if end_date:
            qs = qs.filter(payment_date__lte=end_date)
        if search:
            qs = qs.filter(
                Q(reference_no__icontains=search) |
                Q(notes__icontains=search) |
                Q(client__groom_name__icontains=search) |
                Q(client__bride_name__icontains=search)
            )
        return qs.order_by('-payment_date', '-created_at')

class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related('client', 'recorded_by').all()

class ClientPaymentsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, client_pk):
        client = get_object_or_404(Client, pk=client_pk)
        payments = Payment.objects.filter(client=client).order_by('-payment_date', '-created_at')
        serializer = PaymentSerializer(payments, many=True)

        total_paid_agg = payments.aggregate(total=Sum('amount'))['total']
        total_paid = float(total_paid_agg or 0.0)
        package_price = float(client.package_price or 0.0)
        pending_balance = max(0.0, round(package_price - total_paid, 2))

        if package_price == 0 and total_paid == 0:
            payment_status = 'unspecified'
        elif total_paid >= package_price and package_price > 0:
            payment_status = 'paid'
        elif total_paid > 0:
            payment_status = 'partial'
        else:
            payment_status = 'unpaid'

        return Response({
            'client_id': str(client.id),
            'client_name': f"{client.groom_name} & {client.bride_name}",
            'package_price': package_price,
            'total_paid': total_paid,
            'pending_balance': pending_balance,
            'payment_status': payment_status,
            'payments': serializer.data
        })

class PaymentSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        total_collected = Payment.objects.aggregate(total=Sum('amount'))['total'] or 0.0
        
        cash_collected = Payment.objects.filter(method='cash').aggregate(total=Sum('amount'))['total'] or 0.0
        online_collected = Payment.objects.filter(method__in=['online', 'upi', 'card']).aggregate(total=Sum('amount'))['total'] or 0.0
        advance_collected = Payment.objects.filter(payment_type='advance').aggregate(total=Sum('amount'))['total'] or 0.0
        
        # Calculate active clients contract value
        total_contracts = Client.objects.filter(deleted_at__isnull=True).aggregate(total=Sum('package_price'))['total'] or 0.0
        pending_receivables = max(0.0, float(total_contracts) - float(total_collected))

        total_transactions = Payment.objects.count()

        recent = Payment.objects.select_related('client', 'recorded_by').order_by('-payment_date', '-created_at')[:5]
        recent_serializer = PaymentSerializer(recent, many=True)

        return Response({
            'total_collected': float(total_collected),
            'total_cash': float(cash_collected),
            'total_online': float(online_collected),
            'advance_collected': float(advance_collected),
            'total_contract_value': float(total_contracts),
            'pending_receivables': float(pending_receivables),
            'total_transactions': total_transactions,
            'recent_payments': recent_serializer.data
        })


from rest_framework import serializers
from .models import Payment
from apps.clients.models import Client

class PaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField(read_only=True)
    client_event_date = serializers.SerializerMethodField(read_only=True)
    client_package_price = serializers.SerializerMethodField(read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)
    recorded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id', 'client', 'client_name', 'client_event_date', 'client_package_price',
            'amount', 'method', 'method_display',
            'payment_type', 'payment_type_display',
            'payment_date', 'reference_no', 'notes',
            'recorded_by', 'recorded_by_name',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'recorded_by', 'created_at', 'updated_at')

    def get_client_name(self, obj):
        if obj.client:
            return f"{obj.client.groom_name} & {obj.client.bride_name}"
        return ""

    def get_client_event_date(self, obj):
        return obj.client.event_date if obj.client else None

    def get_client_package_price(self, obj):
        return float(obj.client.package_price or 0.0) if obj.client else 0.0

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.name if obj.recorded_by else None

    def validate_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


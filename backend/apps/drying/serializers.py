# drying/serializers.py
from rest_framework import serializers
from .models import Dryer, DryingSession


class DryerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Dryer
        fields = '__all__'


class DryingSessionSerializer(serializers.ModelSerializer):
    dryer_name        = serializers.CharField(source='dryer.name',            read_only=True)
    fabric_material   = serializers.CharField(source='fabric.material_type',  read_only=True)
    supervisor_name   = serializers.CharField(source='supervisor.username',   read_only=True)
    decolor_session_id= serializers.IntegerField(source='decolor_session.id', read_only=True, default=None)
    moisture_loss_kg  = serializers.SerializerMethodField()
    output_efficiency = serializers.SerializerMethodField()

    def get_moisture_loss_kg(self, obj) -> float:
        return obj.moisture_loss_kg

    def get_output_efficiency(self, obj) -> float:
        return obj.output_efficiency_pct

    class Meta:
        model  = DryingSession
        fields = '__all__'

    def validate(self, data):
        from apps.quality.services import check_lot_change
        check_lot_change(self, data, 'dried')
        return data

from decimal import Decimal

from rest_framework import serializers

from .models import NotificationRule
from .rules import allowed_roles


class NotificationRuleSerializer(serializers.ModelSerializer):
    # Roles that can open the module this rule reads from; only these can be chosen
    allowed_roles = serializers.SerializerMethodField()

    class Meta:
        model = NotificationRule
        fields = ['id', 'key', 'title', 'description', 'is_enabled', 'threshold', 'threshold_label', 'roles',
                  'allowed_roles', 'send_email', 'escalate_after_days']
        read_only_fields = ['key', 'title', 'description', 'threshold_label']

    def get_allowed_roles(self, obj) -> list[str]:
        return sorted(allowed_roles(obj.key))

    def validate_roles(self, roles):
        if not isinstance(roles, list) or any(not isinstance(role, str) for role in roles):
            raise serializers.ValidationError('Give the roles as a list.')
        allowed = allowed_roles(self.instance.key)
        refused = sorted(set(roles) - allowed)
        if refused:
            names = ', '.join(role.replace('_', ' ') for role in refused)
            raise serializers.ValidationError(
                f"This can't be sent to: {names}. That role has no access to the records behind this rule.")
        return sorted(set(roles))

    def validate(self, data):
        rule = self.instance
        if 'threshold' in data:
            threshold = data['threshold']
            if not rule.threshold_label:
                if threshold is not None:
                    raise serializers.ValidationError({'threshold': ['This rule has no number to set.']})
            elif threshold is None:
                raise serializers.ValidationError({'threshold': ['Enter a number.']})
            elif threshold < 0:
                raise serializers.ValidationError({'threshold': ["The number can't be negative."]})
            elif rule.key == 'chemical-low' and threshold > Decimal('100'):
                raise serializers.ValidationError({'threshold': ["A percentage can't be more than 100."]})
        return data

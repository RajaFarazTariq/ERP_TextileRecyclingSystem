from django.db import models
from apps.sorting.models import FabricStock
from apps.users.models import CustomUser


class ChemicalStock(models.Model):
    chemical_name = models.CharField(max_length=255)
    total_stock = models.DecimalField(max_digits=10, decimal_places=2)
    issued_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    remaining_stock = models.DecimalField(max_digits=10, decimal_places=2)
    unit_of_measure = models.CharField(
        max_length=50, default='Liters'
    )
    last_updated = models.DateTimeField(auto_now=True)
    # Cost and safety (all optional; added in Phase 5)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                    help_text='Rs. per unit of measure; receiving a lot updates it')
    supplier = models.ForeignKey('warehouse.Vendor', on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='chemicals')
    hazard_class = models.CharField(max_length=100, blank=True, default='',
                                    help_text='e.g. Corrosive, Oxidizer')
    handling_notes = models.TextField(blank=True, default='')
    sds_reference = models.CharField(max_length=255, blank=True, default='',
                                     help_text='Where the safety data sheet is kept: a link or a file reference')
    is_restricted = models.BooleanField(default=False, help_text='Only an admin may issue it')

    def __str__(self):
        return f"{self.chemical_name} - {self.remaining_stock} {self.unit_of_measure}"


class ChemicalLot(models.Model):
    """A received batch of a chemical. Receiving it adds its quantity to the chemical's stock."""
    chemical = models.ForeignKey(ChemicalStock, on_delete=models.PROTECT, related_name='lots')
    lot_number = models.CharField(max_length=100)
    supplier = models.ForeignKey('warehouse.Vendor', on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='chemical_lots')
    received_on = models.DateField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    received_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='chemical_lots')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_on', '-id']
        constraints = [models.UniqueConstraint(fields=['chemical', 'lot_number'], name='unique_chemical_lot')]

    def __str__(self):
        return f'{self.chemical.chemical_name} lot {self.lot_number}'


class Recipe(models.Model):
    """A chemical formulation for one kind of material. Its content lives in numbered versions."""
    name = models.CharField(max_length=150, unique=True)
    material_type = models.CharField(max_length=255, blank=True, default='',
                                     help_text='Leave empty to use for any material')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class RecipeVersion(models.Model):
    """One revision of a recipe. Never edited: a change makes the next version, so sessions keep what they used."""
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='versions')
    version = models.PositiveIntegerField()
    temperature_c = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    water_liters_per_100kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True, default='', help_text='What changed in this version')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        constraints = [models.UniqueConstraint(fields=['recipe', 'version'], name='unique_recipe_version')]

    def __str__(self):
        return f'{self.recipe.name} v{self.version}'


class RecipeLine(models.Model):
    version = models.ForeignKey(RecipeVersion, on_delete=models.CASCADE, related_name='lines')
    chemical = models.ForeignKey(ChemicalStock, on_delete=models.PROTECT, related_name='recipe_lines')
    quantity_per_100kg = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.version}: {self.chemical.chemical_name}'


class Tank(models.Model):
    STATUS_CHOICES = [
        ('Empty', 'Empty'),
        ('Filled', 'Filled'),
        ('Processing', 'Processing'),
        ('Completed', 'Completed'),
        ('Cleaning', 'Cleaning'),
    ]

    name = models.CharField(max_length=100)
    capacity = models.DecimalField(max_digits=10, decimal_places=2)
    fabric = models.ForeignKey(
        FabricStock, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tanks'
    )
    batch_id = models.CharField(max_length=100, unique=True)
    tank_status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default='Empty'
    )
    fabric_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    start_date = models.DateTimeField(null=True, blank=True)
    expected_completion = models.DateTimeField(null=True, blank=True)
    actual_completion = models.DateTimeField(null=True, blank=True)
    supervisor = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tanks'
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - Batch {self.batch_id} - {self.tank_status}"


class ChemicalIssuance(models.Model):
    chemical = models.ForeignKey(
        ChemicalStock, on_delete=models.PROTECT,
        related_name='issuances'
    )
    tank = models.ForeignKey(
        Tank, on_delete=models.PROTECT,
        related_name='chemical_issuances'
    )
    issued_by = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT,
        related_name='chemical_issuances'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    issued_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    # The batch the chemical was used on (set automatically when the tank has one session running)
    session = models.ForeignKey('DecolorizationSession', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='issuances')
    # The chemical's cost when issued, so later price changes don't rewrite past batches
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0, editable=False)

    def __str__(self):
        return f"{self.chemical.chemical_name} - {self.quantity} issued to {self.tank.name}"


class DecolorizationSession(models.Model):
    STATUS_CHOICES = [
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
        ('On Hold', 'On Hold'),
    ]

    tank = models.ForeignKey(
        Tank, on_delete=models.PROTECT,
        related_name='sessions'
    )
    fabric = models.ForeignKey(
        FabricStock, on_delete=models.PROTECT,
        related_name='decolorization_sessions'
    )
    supervisor = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT,
        related_name='decolorization_sessions'
    )
    input_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    output_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    waste_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='In Progress'
    )
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    # Process record (all optional; added in Phase 5)
    recipe_version = models.ForeignKey('RecipeVersion', on_delete=models.PROTECT, null=True, blank=True,
                                       related_name='sessions')
    temperature_c = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    water_liters = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    approved_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    approved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Tank {self.tank.name} - {self.fabric.material_type} - {self.status}"
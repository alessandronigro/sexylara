import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../models/girlfriend.dart';
import '../services/girlfriend_service.dart';
import '../services/supabase_service.dart';

class CreateGirlfriendScreen extends StatefulWidget {
  const CreateGirlfriendScreen({super.key});

  @override
  State<CreateGirlfriendScreen> createState() => _CreateGirlfriendScreenState();
}

class _CreateGirlfriendScreenState extends State<CreateGirlfriendScreen> {
  final _pageController = PageController();
  final _girlfriendService = GirlfriendService();
  int _currentStep = 0;

  // Form data
  String _name = '';
  String _gender = 'female';
  int _age = 25;
  String? _ethnicity;
  String? _bodyType;
  String? _hairLength;
  String? _hairColor;
  String? _eyeColor;
  int _heightCm = 165;
  String? _personalityType;
  String _tone = 'flirty';
  bool _generating = false;

  void _nextStep() {
    if (_currentStep < 4) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep++);
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep--);
    }
  }

  // Avatar will be generated automatically after girlfriend creation

  Future<void> _createGirlfriend() async {
    if (!mounted) return;
    
    String loadingMessage = 'Creando companion...';
    
    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => WillPopScope(
        onWillPop: () async => false,
        child: StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1A1A1A),
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: Colors.pinkAccent),
                    const SizedBox(height: 24),
                    Text(
                      loadingMessage,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Questo potrebbe richiedere qualche secondo',
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
    
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final girlfriend = Girlfriend(
        id: const Uuid().v4(),
        userId: userId,
        name: _name,
        gender: _gender,
        avatarUrl: null, // Will be set after avatar generation
        ethnicity: _ethnicity,
        bodyType: _bodyType,
        hairLength: _hairLength,
        hairColor: _hairColor,
        eyeColor: _eyeColor,
        heightCm: _heightCm,
        age: _age,
        personalityType: _personalityType,
        tone: _tone,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // Create girlfriend first
      await _girlfriendService.createGirlfriend(girlfriend);

      // Close creation dialog and show avatar generation dialog
      if (mounted) {
        Navigator.of(context).pop();
        
        
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => _AvatarGenerationDialog(),
        );
      }
      
      try {
        final characteristics = {
          'name': _name,
          'gender': _gender,
          'age': _age,
          'ethnicity': _ethnicity,
          'bodyType': _bodyType,
          'hairLength': _hairLength,
          'hairColor': _hairColor,
          'eyeColor': _eyeColor,
          'personalityType': _personalityType,
          'tone': _tone,
          'heightCm': _heightCm,
          'girlfriendId': girlfriend.id, // Pass the ID for Supabase upload
        };
        
        final avatarUrl = await _girlfriendService.generateAvatar(characteristics);
        
        // Update the girlfriend with the new avatar
        final updatedGirlfriend = girlfriend.copyWith(avatarUrl: avatarUrl);
        await _girlfriendService.updateGirlfriend(updatedGirlfriend);
      } catch (e) {
        print('Errore generazione avatar: $e');
        // Continue anyway, avatar can be generated later
      }

      // Close loading dialog
      if (mounted) {
        Navigator.of(context).pop();
        // Navigate to chat
        context.go('/chat/${girlfriend.id}');
      }
    } catch (e) {
      // Close loading dialog
      if (mounted) {
        Navigator.of(context).pop();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore creazione: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        automaticallyImplyLeading: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
        title: Row(
          children: [
            const CircleAvatar(
              radius: 18,
              backgroundColor: Colors.pinkAccent,
              child: Icon(Icons.person, size: 20, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Text(
              _name.isNotEmpty ? _name : 'Nuovo',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildProgressIndicator(),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _buildStep1BasicInfo(),
                _buildStep2Physical(),
                _buildStep3Personality(),
                _buildStep4Avatar(),
                _buildStep5Confirm(),
              ],
            ),
          ),
          _buildNavigationButtons(),
        ],
      ),
    );
  }

  Widget _buildProgressIndicator() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: List.generate(5, (index) {
          return Expanded(
            child: Container(
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: index <= _currentStep ? Colors.pinkAccent : Colors.grey[800],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStep1BasicInfo() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Informazioni Base',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 32),
          TextField(
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Nome',
              labelStyle: const TextStyle(color: Colors.grey),
              filled: true,
              fillColor: Colors.grey[900],
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (value) => setState(() => _name = value),
          ),
          const SizedBox(height: 24),
          const Text(
            'Sesso',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ChoiceChip(
                label: const Text('Donna'),
                selected: _gender == 'female',
                onSelected: (selected) => setState(() => _gender = 'female'),
                selectedColor: Colors.pinkAccent,
                backgroundColor: Colors.grey[900],
                labelStyle: TextStyle(
                  color: _gender == 'female' ? Colors.white : Colors.grey[400],
                ),
              ),
              const SizedBox(width: 12),
              ChoiceChip(
                label: const Text('Uomo'),
                selected: _gender == 'male',
                onSelected: (selected) => setState(() => _gender = 'male'),
                selectedColor: Colors.blueAccent,
                backgroundColor: Colors.grey[900],
                labelStyle: TextStyle(
                  color: _gender == 'male' ? Colors.white : Colors.grey[400],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Età: $_age anni',
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          Slider(
            value: _age.toDouble(),
            min: 18,
            max: 45,
            divisions: 27,
            activeColor: Colors.pinkAccent,
            onChanged: (value) => setState(() => _age = value.toInt()),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2Physical() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Aspetto Fisico',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 32),
          _buildDropdown(
            'Etnia',
            _ethnicity,
            ['latina', 'asian', 'european', 'african', 'mixed'],
            (value) => setState(() => _ethnicity = value),
          ),
          const SizedBox(height: 16),
          _buildChipGroup(
            'Tipo di Corpo',
            ['slim', 'curvy', 'athletic', 'petite', 'plus_size'],
            _bodyType,
            (value) => setState(() => _bodyType = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Lunghezza Capelli',
            _hairLength,
            ['short', 'medium', 'long'],
            (value) => setState(() => _hairLength = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Colore Capelli',
            _hairColor,
            ['blonde', 'brunette', 'black', 'red'],
            (value) => setState(() => _hairColor = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Colore Occhi',
            _eyeColor,
            ['brown', 'blue', 'green', 'hazel', 'gray'],
            (value) => setState(() => _eyeColor = value),
          ),
          const SizedBox(height: 24),
          Text(
            'Altezza: $_heightCm cm',
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          Slider(
            value: _heightCm.toDouble(),
            min: 150,
            max: 185,
            divisions: 35,
            activeColor: Colors.pinkAccent,
            onChanged: (value) => setState(() => _heightCm = value.toInt()),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3Personality() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Personalità',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 32),
          _buildChipGroup(
            'Tipo di Personalità',
            ['sweet', 'sexy', 'shy', 'dominant', 'playful', 'romantic', 'mysterious'],
            _personalityType,
            (value) => setState(() => _personalityType = value),
          ),
          const SizedBox(height: 32),
          Text(
            'Tono di Conversazione: ${_getToneName(_tone)}',
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Slider(
            value: ['friendly', 'flirty', 'romantic', 'explicit'].indexOf(_tone).toDouble(),
            min: 0,
            max: 3,
            divisions: 3,
            activeColor: Colors.pinkAccent,
            label: _getToneName(_tone),
            onChanged: (value) {
              setState(() {
                _tone = ['friendly', 'flirty', 'romantic', 'explicit'][value.toInt()];
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStep4Avatar() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text(
            'Avatar',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 32),
          Container(
            width: 300,
            height: 300,
            decoration: BoxDecoration(
              color: Colors.grey[900],
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Icon(
                Icons.auto_awesome,
                size: 100,
                color: Colors.pinkAccent,
              ),
            ),
          ),
          const SizedBox(height: 32),
          const Text(
            'L\'avatar verrà generato automaticamente',
            style: TextStyle(
              fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Creeremo un\'immagine personalizzata basata sulle caratteristiche che hai scelto',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[400],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildStep5Confirm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Conferma',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 32),
          Center(
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                color: Colors.grey[900],
                borderRadius: BorderRadius.circular(100),
              ),
              child: const Icon(
                Icons.auto_awesome,
                size: 60,
                color: Colors.pinkAccent,
              ),
            ),
          ),
          const SizedBox(height: 24),
          _buildDetailRow('Nome', _name),
          _buildDetailRow('Sesso', _gender == 'male' ? 'Uomo' : 'Donna'),
          _buildDetailRow('Età', '$_age anni'),
          if (_ethnicity != null) _buildDetailRow('Etnia', _ethnicity!),
          if (_bodyType != null) _buildDetailRow('Corpo', _bodyType!),
          if (_hairLength != null && _hairColor != null)
            _buildDetailRow('Capelli', '$_hairLength $_hairColor'),
          if (_eyeColor != null) _buildDetailRow('Occhi', _eyeColor!),
          _buildDetailRow('Altezza', '$_heightCm cm'),
          if (_personalityType != null) _buildDetailRow('Personalità', _personalityType!),
          _buildDetailRow('Tono', _getToneName(_tone)),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.grey[400], fontSize: 16),
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdown(
    String label,
    String? value,
    List<String> items,
    Function(String?) onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: value,
          dropdownColor: Colors.grey[900],
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.grey[900],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
          items: items.map((item) {
            return DropdownMenuItem(
              value: item,
              child: Text(item),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _buildChipGroup(
    String label,
    List<String> options,
    String? selected,
    Function(String) onSelected,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((option) {
            final isSelected = selected == option;
            return ChoiceChip(
              label: Text(option),
              selected: isSelected,
              onSelected: (selected) => onSelected(option),
              selectedColor: Colors.pinkAccent,
              backgroundColor: Colors.grey[900],
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.grey[400],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildNavigationButtons() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentStep > 0)
              Expanded(
                child: OutlinedButton(
                  onPressed: _previousStep,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.grey),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('Indietro'),
                ),
              ),
            if (_currentStep > 0) const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                onPressed: _currentStep == 4 ? _createGirlfriend : _nextStep,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.pinkAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: Text(_currentStep == 4 ? 'Crea Companion' : 'Avanti'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getToneName(String tone) {
    switch (tone) {
      case 'friendly':
        return 'Amichevole';
      case 'flirty':
        return 'Civettuola';
      case 'romantic':
        return 'Romantica';
      case 'explicit':
        return 'Esplicita';
      default:
        return tone;
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

// Widget for avatar generation with feature slides
class _AvatarGenerationDialog extends StatefulWidget {
  @override
  State<_AvatarGenerationDialog> createState() => _AvatarGenerationDialogState();
}

class _AvatarGenerationDialogState extends State<_AvatarGenerationDialog> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, String>> _features = [
    {
      'icon': '💬',
      'title': 'Chat Intelligenti',
      'description': 'Conversazioni naturali e coinvolgenti con AI avanzata'
    },
    {
      'icon': '🎨',
      'title': 'Immagini Personalizzate',
      'description': 'Genera foto uniche del tuo companion in qualsiasi momento'
    },
    {
      'icon': '👥',
      'title': 'Chat di Gruppo',
      'description': 'Crea gruppi con più companion per conversazioni dinamiche'
    },
    {
      'icon': '🎭',
      'title': 'Personalizzazione Totale',
      'description': 'Crea companion unici con personalità e aspetto su misura'
    },
    {
      'icon': '🌍',
      'title': 'Multilingua',
      'description': 'Chatta nella tua lingua preferita senza limiti'
    },
  ];

  @override
  void initState() {
    super.initState();
    // Auto-scroll every 3 seconds
    Future.delayed(const Duration(seconds: 3), _autoScroll);
  }

  void _autoScroll() {
    if (!mounted) return;
    final nextPage = (_currentPage + 1) % _features.length;
    _pageController.animateToPage(
      nextPage,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
    Future.delayed(const Duration(seconds: 3), _autoScroll);
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => false,
      child: Dialog(
        backgroundColor: const Color(0xFF1A1A1A),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(
                  width: 30,
                  height: 30,
                  child: CircularProgressIndicator(
                    color: Colors.pinkAccent,
                    strokeWidth: 3,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Creando il tuo companion...',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 140,
                  child: PageView.builder(
                    controller: _pageController,
                    onPageChanged: (index) => setState(() => _currentPage = index),
                    itemCount: _features.length,
                    itemBuilder: (context, index) {
                      final feature = _features[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              feature['icon']!,
                              style: const TextStyle(fontSize: 36),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              feature['title']!,
                              style: const TextStyle(
                                color: Colors.pinkAccent,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              feature['description']!,
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 12,
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _features.length,
                    (index) => Container(
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _currentPage == index
                            ? Colors.pinkAccent
                            : Colors.grey[700],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

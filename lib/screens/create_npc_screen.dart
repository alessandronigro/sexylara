import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../models/npc.dart';
import '../services/npc_service.dart';
import '../services/supabase_service.dart';

class CreateNpcScreen extends StatefulWidget {
  const CreateNpcScreen({super.key});

  @override
  State<CreateNpcScreen> createState() => _CreateNpcScreenState();
}

class _CreateNpcScreenState extends State<CreateNpcScreen> {
  final _pageController = PageController();
  final _npcService = NpcService();
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

  // Label maps (IT) with gendered forms where needed
  final Map<String, Map<String, String>> _ethnicityLabels = const {
    'latina': {'f': 'Latina', 'm': 'Latino'},
    'asian': {'f': 'Asiatica', 'm': 'Asiatico'},
    'european': {'f': 'Europea', 'm': 'Europeo'},
    'african': {'f': 'Africana', 'm': 'Africano'},
    'mixed': {'f': 'Mista', 'm': 'Misto'},
  };
  final Map<String, Map<String, String>> _bodyTypeLabels = const {
    'slim': {'f': 'Snella', 'm': 'Snello'},
    'curvy': {'f': 'Formosa', 'm': 'Robusto'},
    'athletic': {'f': 'Atletica', 'm': 'Atletico'},
    'petite': {'f': 'Minuta', 'm': 'Minuto'},
    'plus_size': {'f': 'Morbida', 'm': 'Robusta'},
  };
  final Map<String, Map<String, String>> _hairLengthLabels = const {
    'short': {'f': 'Corti', 'm': 'Corti'},
    'medium': {'f': 'Medi', 'm': 'Medi'},
    'long': {'f': 'Lunghi', 'm': 'Lunghi'},
  };
  final Map<String, Map<String, String>> _hairColorLabels = const {
    'blonde': {'f': 'Biondi', 'm': 'Biondi'},
    'brunette': {'f': 'Castani', 'm': 'Castani'},
    'black': {'f': 'Neri', 'm': 'Neri'},
    'red': {'f': 'Rossi', 'm': 'Rossi'},
  };
  final Map<String, Map<String, String>> _eyeColorLabels = const {
    'brown': {'f': 'Marroni', 'm': 'Marroni'},
    'blue': {'f': 'Blu', 'm': 'Blu'},
    'green': {'f': 'Verdi', 'm': 'Verdi'},
    'hazel': {'f': 'Nocciola', 'm': 'Nocciola'},
    'gray': {'f': 'Grigi', 'm': 'Grigi'},
  };
  final Map<String, Map<String, String>> _personalityLabels = const {
    'sweet': {'f': 'Dolce', 'm': 'Dolce'},
    'sexy': {'f': 'Sensuale', 'm': 'Sensuale'},
    'shy': {'f': 'Timida', 'm': 'Timido'},
    'dominant': {'f': 'Dominante', 'm': 'Dominante'},
    'playful': {'f': 'Giocherellona', 'm': 'Giocherellone'},
    'romantic': {'f': 'Romantica', 'm': 'Romantico'},
    'mysterious': {'f': 'Misteriosa', 'm': 'Misterioso'},
  };

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

  // Avatar will be generated automatically after npc creation

  Future<void> _createNpc() async {
    if (!mounted) return;
    setState(() => _generating = true);

    const loadingMessage = 'Creando il tuo Thriller...';

    // Show loading dialog con animazione pulsante
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => WillPopScope(
        onWillPop: () async => false,
        child: const _AnimatedGeneratingDialog(message: loadingMessage),
      ),
    );

    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      // Build seed for generator
      final seed = {
        'gender': _gender,
        'ageRange': _age,
        'name': _name,
        'archetype': _personalityType ?? _tone,
        'vibe': _tone,
        'sensuality': 'soft',
        'language': 'it',
        'hints': {
          'ethnicity': _ethnicity,
          'bodyType': _bodyType,
          'hairLength': _hairLength,
          'hairColor': _hairColor,
          'eyeColor': _eyeColor,
          'heightCm': _heightCm,
        },
      };

      // Call backend generator
      final generated = await _npcService.createNpcViaGenerator(seed: seed);
      final npcId = generated['npc_id']?.toString();
      final avatarUrl = generated['avatar_url']?.toString();

      // Close loading dialog
      if (mounted) {
        Navigator.of(context).pop();
        // Navigate to chat
        if (npcId != null) {
          context.go('/chat/$npcId');
        } else {
          context.go('/');
        }

        // Optionally show avatar generation modal if avatar is missing
        if (avatarUrl == null) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (context) => _AvatarGenerationDialog(),
          );
        }
      }
    } catch (e) {
      // Close loading dialog
      if (mounted) {
        Navigator.of(context).pop();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore creazione: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
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
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              height: index == _currentStep ? 6 : 4,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: index <= _currentStep ? Colors.pinkAccent : Colors.grey[800],
                borderRadius: BorderRadius.circular(8),
                boxShadow: index == _currentStep
                    ? [
                        BoxShadow(
                          color: Colors.pinkAccent.withOpacity(0.4),
                          blurRadius: 8,
                          spreadRadius: 1,
                        )
                      ]
                    : [],
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
            _resolveLabels(_ethnicityLabels),
            (value) => setState(() => _ethnicity = value),
          ),
          const SizedBox(height: 16),
          _buildChipGroup(
            'Tipo di Corpo',
            _resolveLabels(_bodyTypeLabels),
            _bodyType,
            (value) => setState(() => _bodyType = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Lunghezza Capelli',
            _hairLength,
            _resolveLabels(_hairLengthLabels),
            (value) => setState(() => _hairLength = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Colore Capelli',
            _hairColor,
            _resolveLabels(_hairColorLabels),
            (value) => setState(() => _hairColor = value),
          ),
          const SizedBox(height: 16),
          _buildDropdown(
            'Colore Occhi',
            _eyeColor,
            _resolveLabels(_eyeColorLabels),
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
            _resolveLabels(_personalityLabels),
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
          if (_ethnicity != null) _buildDetailRow('Etnia', _resolveLabels(_ethnicityLabels)[_ethnicity!] ?? _ethnicity!),
          if (_bodyType != null) _buildDetailRow('Corpo', _resolveLabels(_bodyTypeLabels)[_bodyType!] ?? _bodyType!),
          if (_hairLength != null && _hairColor != null)
            _buildDetailRow(
                'Capelli',
                '${_resolveLabels(_hairLengthLabels)[_hairLength!] ?? _hairLength} ${_resolveLabels(_hairColorLabels)[_hairColor!] ?? _hairColor}'),
          if (_eyeColor != null) _buildDetailRow('Occhi', _resolveLabels(_eyeColorLabels)[_eyeColor!] ?? _eyeColor!),
          _buildDetailRow('Altezza', '$_heightCm cm'),
          if (_personalityType != null)
            _buildDetailRow('Personalità', _resolveLabels(_personalityLabels)[_personalityType!] ?? _personalityType!),
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
    Map<String, String> options,
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
          items: options.entries.map((entry) {
            return DropdownMenuItem(
              value: entry.key,
              child: Text(entry.value),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _buildChipGroup(
    String label,
    Map<String, String> options,
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
          children: options.entries.map((entry) {
            final code = entry.key;
            final text = entry.value;
            final isSelected = selected == code;
            return ChoiceChip(
              label: Text(text),
              selected: isSelected,
              onSelected: (selected) => onSelected(code),
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
                onPressed: _currentStep == 4 ? _createNpc : _nextStep,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.pinkAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: Text(_currentStep == 4 ? 'Crea Thriller' : 'Avanti'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getToneName(String tone) {
    final isMale = _gender == 'male';
    switch (tone) {
      case 'friendly':
        return 'Amichevole';
      case 'flirty':
        return isMale ? 'Civettuolo' : 'Civettuola';
      case 'romantic':
        return isMale ? 'Romantico' : 'Romantica';
      case 'explicit':
        return 'Esplicita';
      default:
        return tone;
    }
  }

  Map<String, String> _resolveLabels(Map<String, Map<String, String>> source) {
    final isMale = _gender == 'male';
    return source.map((key, val) => MapEntry(key, isMale ? (val['m'] ?? val['f'] ?? key) : (val['f'] ?? val['m'] ?? key)));
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

class _AnimatedGeneratingDialog extends StatefulWidget {
  final String message;
  const _AnimatedGeneratingDialog({required this.message});

  @override
  State<_AnimatedGeneratingDialog> createState() => _AnimatedGeneratingDialogState();
}

class _AnimatedGeneratingDialogState extends State<_AnimatedGeneratingDialog> {
  bool _pulseUp = true;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1A1A1A),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: _pulseUp ? 0.9 : 1.05, end: _pulseUp ? 1.05 : 0.9),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeInOut,
              onEnd: () => setState(() => _pulseUp = !_pulseUp),
              builder: (context, value, child) {
                return Transform.scale(
                  scale: value,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Colors.pinkAccent, Color(0xFF9C27B0)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.pinkAccent.withOpacity(0.5),
                          blurRadius: 16,
                          spreadRadius: 2,
                        )
                      ],
                    ),
                    child: const Center(
                      child: Icon(Icons.auto_awesome, color: Colors.white, size: 48),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            Text(
              widget.message,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
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
      'description': 'Genera foto uniche del tuo Thriller in qualsiasi momento'
    },
    {
      'icon': '👥',
      'title': 'Chat di Gruppo',
      'description': 'Crea gruppi con più Thrillers per conversazioni dinamiche'
    },
    {
      'icon': '🎭',
      'title': 'Personalizzazione Totale',
      'description': 'Crea Thrillers unici con personalità e aspetto su misura'
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
                  'Creando il tuo Thriller...',
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

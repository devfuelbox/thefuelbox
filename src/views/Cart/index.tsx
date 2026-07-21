import { Button, Card, Spinner } from '@/components/ui';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';
import { useCart } from '@/hooks/useCart';
import { useAuthStore } from '@/store/authStore';
import { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { AdManager } from '@/components/advertisement/AdManager';

export default function Cart() {
  const [loading, setLoading] = useState(true);
  const { items, updateQuantity, removeItem, totalPrice, clearCart } = useCart();
  const { user, hasPurchased } = useAuthStore();
  const isNewUser = !user || !hasPurchased;
  const checkoutLink = isNewUser ? ROUTES.CHECKOUT : ROUTES.SUMMARY;

  // Simulate loading delay for demo purposes
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <Spinner size="lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-gray-900 font-heading">Your Cart</h1>
        <p className="mt-4 text-gray-600">Your cart is empty.</p>
        <Link to={ROUTES.MENU}>
          <Button className="mt-4">Browse Menu</Button>
        </Link>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 pt-8 pb-16">
      <AdManager />
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 font-heading">
              Your Cart
            </h1>
            <div className="mt-1">
              <p className="text-sm text-gray-600">
                {items.length} Dish(es) Selected
              </p>
            </div>
          </div>
          <button
            onClick={clearCart}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 rounded-lg px-3 py-2 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Clear your Cart</span>
            <span className="sm:hidden">Clear</span>
          </button>
        </div>
        <div className="flex flex-col items-center gap-8">
            
          <div className="w-full max-w-2xl space-y-4">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01, translateY: -2 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white shadow-sm hover:shadow-md transition-shadow rounded-xl border border-gray-100 gap-4">
                  <div className="flex items-center flex-1">
                    {(() => {
                        const getImageUrl = (name: string, url?: string) => {
                          if (!name) return url || null;
                          if (name === 'Broccoli (cooked)') return 'broccolicooked.jpg';
                          if (name === 'Weight Gain - Combo 1') return 'weight_gain_combo_1.jpg';
                          if (name === 'Weight Gain - Combo 2') return 'weight_gain_combo_2.jpg';
                          if (name === 'Weight Gain - Combo 3') return 'weight_gain_combo_3.jpg';
                          if (name === 'Muscle Gain - Combo 1') return 'muscle_gain_combo_1.jpg';
                          if (name === 'Muscle Gain - Combo 2') return 'muscle_gain_combo_2.jpg';
                          if (name === 'Muscle Gain - Combo 3') return 'muscle_gain_combo_3.jpg';
                          if (name === 'Weight Loss - Combo 1') return 'weight_loss_combo_1.jpg';
                          if (name === 'Weight Loss - Combo 2') return 'weight_loss_combo_2.jpg';
                          if (name === 'Weight Loss - Combo 3') return 'weight_loss_combo_3.jpg';
                          
                          const calc = name.replace(/\s*\([^)]*\)/g, '').toLowerCase().replace(/[^a-z]/g, '') + '.jpg';
                        const validImages = [
                          'apple.jpg', 'banana.jpg', 'beetroot.jpg', 'blackchanna.jpg', 'broccoli.jpg',
                          'broccolicooked.jpg', 'cabbage.jpg', 'carrot.jpg', 'chapati.jpg', 'cherry.jpg',
                          'chickenbreast.jpg', 'chickpeas.jpg', 'cucumber.jpg', 'dragonfruit.jpg', 'egg.jpg',
                          'grapes.jpg', 'greenbeans.jpg', 'guava.jpg', 'lettuce.jpg', 'mango.jpg',
                          'nendranbanana.jpg', 'onion.jpg', 'orange.jpg', 'paneer.jpg', 'paneercheesedressing.jpg',
                          'papaya.jpg', 'peanut.jpg', 'pomegranate.jpg', 'poovanbanana.jpg', 'purplecabbage.jpg',
                          'rasthalibanana.jpg', 'redbanana.jpg', 'regularbanana.jpg', 'soya.jpg', 'strawberry.jpg',
                          'sweetpotato.jpg', 'watermelon.jpg', 'whitechanna.jpg', 'whiterice.jpg'
                        ];
                        
                        if (validImages.includes(calc)) return calc;
                        return url || null;
                      };
                      const imgSrc = getImageUrl(item.menuItem.name, item.menuItem.image_url ?? undefined);
                       return imgSrc ? (
                        <img
                          src={`/images/${imgSrc}`}
                          alt={item.menuItem.name}
                          className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg mr-3 sm:mr-4 shadow-sm shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg mr-4 flex items-center justify-center text-gray-400">
                          No image
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{item.menuItem.name}</h3>
                      {item.menuItem.description && (
                        <p className="mt-1 text-sm text-gray-500">{item.menuItem.description}</p>
                      )}
            <p className="mt-1 text-sm text-gray-600">Quantity: {(item.menuItem.category === 'main' || item.menuItem.category === 'side') ? '100g' : '300g'}</p>
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              <p><strong>{item.menuItem.protein}g</strong> protein</p>
              <p><strong>{item.menuItem.calories}</strong> calories</p>
              <p><strong>{item.menuItem.fat}g</strong> fat</p>
            
            </div>

                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 sm:ml-auto">
                    <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.menuItem.id, Math.max(0, item.quantity - 1))}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-gray-600 transition-all"
                      >
                        -
                      </motion.button>
                      <span className="w-8 text-center font-semibold text-gray-900">{item.quantity}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-gray-600 transition-all"
                      >
                        +
                      </motion.button>
                    </div>
                    
                    <button 
                      onClick={() => removeItem(item.menuItem.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Remove item"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}

          </div>
      </div>

<div className="mt-8 flex justify-center">
  <Link to={checkoutLink} className="block w-full max-w-xs">
    <Button size="lg" className="w-full py-4 text-lg rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 bg-gradient-to-r from-brand-600 to-brand-500">
      {isNewUser ? 'Proceed to Checkout' : 'Proceed to Summary'}
    </Button>
  </Link>
</div>


          
      </section>
    </div>
  );
}

package com.meteucar.slot;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // WebView çubukların altına çizilir; boşluğu web tarafı env(safe-area-inset-*)
        // ile bırakır (iOS ile aynı mekanizma). Android 15+ bunu zaten zorunlu kılıyor,
        // Android 14 ve öncesinde açıkça istenmezse Capacitor inset'leri WebView'e
        // geçirse de pencere çubukların arasında kalıyor ve env() 0 dönüyordu.
        // Capacitor 8'in SystemBars notu bu çağrıyı öneriyor, 9'da kendisi yapacak.
        //
        // İki çubuk da koyu stil ve saydam zemin: ikonlar açık, arkada uygulamanın
        // zemini görünür. auto() yerine dark(): 3 tuşlu gezinmede auto(), sistem
        // açık moddayken yarı saydam beyaz bir kontrast katmanı çiziyor.
        //
        // super.onCreate'ten SONRA: BridgeActivity temayı orada NoActionBar'a
        // çeviriyor. Önce çağrılınca pencere açılış temasıyla kuruluyor ve
        // üstte bir başlık çubuğu kalıyordu.
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
    }
}

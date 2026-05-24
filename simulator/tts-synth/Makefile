# Build jibo-speak against Jibo x86 TTS libraries.
# Set JIBO_TTS_ROOT to the directory containing include/ and lib/ (e.g. Downloads-old/jibo(6)/jibo).

FST_INC ?= /tmp/fst-dev/usr/include
JIBO_TTS_ROOT ?= $(dir $(abspath $(lastword $(MAKEFILE_LIST))))jibo-tts-sdk
JIBO_LIB = $(JIBO_TTS_ROOT)/lib
JIBO_INC = $(JIBO_TTS_ROOT)/include
CXX ?= g++
CXXFLAGS = -std=c++11 -O2 -Wall -D_GLIBCXX_USE_CXX11_ABI=0 -I$(JIBO_INC) -I$(FST_INC) -no-pie
LDFLAGS = -no-pie -L$(JIBO_LIB) -L$(JIBO_LIB)/poco -L/tmp/fst-dev/usr/lib/x86_64-linux-gnu -Wl,-rpath,$(JIBO_LIB):$(JIBO_LIB)/poco
LIBS = $(JIBO_LIB)/libJiboTTSEngine.a \
       $(JIBO_LIB)/libJiboTTSTextnorm.a \
       $(JIBO_LIB)/libjibonlu.a \
       $(JIBO_LIB)/libfst.so.3.0.0 \
       $(JIBO_LIB)/libv8_base.a \
       $(JIBO_LIB)/libv8_nosnapshot.a \
       $(JIBO_LIB)/libv8_libplatform.a \
       $(JIBO_LIB)/libv8_libbase.a \
       -lJiboTTSService -lJiboUtil \
       -lPocoFoundation -lPocoUtil -lPocoNet -lPocoJSON -lPocoXML \
       -lstdc++ -lm -lpthread -ldl -lrt

.PHONY: all clean

all: jibo-speak

jibo-speak: jibo-speak.cpp
	$(CXX) $(CXXFLAGS) -o $@ $< $(LDFLAGS) $(LIBS)

clean:
	rm -f jibo-speak

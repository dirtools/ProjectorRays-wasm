VERSION_NUMBER=0.2.1
GIT_SHA=$(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)

CPPFLAGS+=-DVERSION_NUMBER=$(VERSION_NUMBER) -DGIT_SHA=$(GIT_SHA)

DIST_DIR ?= dist
WASM_OUTPUT=$(DIST_DIR)/projectorrays.js
WASM_CJS_OUTPUT=$(DIST_DIR)/projectorrays.cjs
WASM_SINGLE_OUTPUT=$(DIST_DIR)/projectorrays.single.js

PROJECTORRAYS_DIR ?= third_party/ProjectorRays
PROJECTORRAYS_SRC_DIR ?= $(PROJECTORRAYS_DIR)/src
PROJECTORRAYS_FONTMAP_DIR ?= $(PROJECTORRAYS_DIR)/fontmaps

WASM_MPG123 = 1
MPG123_DIR ?= third_party/mpg123
MPG123_WASM_BUILD_DIR ?= $(MPG123_DIR)/build-wasm
MPG123_WASM_INCLUDE ?= $(MPG123_DIR)/src/include
MPG123_WASM_LIB ?= $(MPG123_WASM_BUILD_DIR)/src/libmpg123/.libs/libmpg123.a
WASM_MPG123_CFLAGS = $(if $(filter 1,$(WASM_MPG123)),-I$(MPG123_WASM_INCLUDE),)
WASM_MPG123_LIBS = $(if $(filter 1,$(WASM_MPG123)),$(MPG123_WASM_LIB),)

FONTMAPS = $(wildcard $(PROJECTORRAYS_FONTMAP_DIR)/*.txt)
FONTMAP_HEADERS = $(patsubst %.txt,%.h,$(FONTMAPS))

WASM_SOURCES = \
	src/cpp/main.cpp \
	$(PROJECTORRAYS_SRC_DIR)/common/codewriter.cpp \
	$(PROJECTORRAYS_SRC_DIR)/common/json.cpp \
	$(PROJECTORRAYS_SRC_DIR)/common/log.cpp \
	$(PROJECTORRAYS_SRC_DIR)/common/stream.cpp \
	$(PROJECTORRAYS_SRC_DIR)/common/util.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/castmember.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/chunk.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/dirfile.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/fontmap.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/guid.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/sound.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/subchunk.cpp \
	$(PROJECTORRAYS_SRC_DIR)/director/util.cpp \
	$(PROJECTORRAYS_SRC_DIR)/io/fileio.cpp \
	$(PROJECTORRAYS_SRC_DIR)/io/options.cpp \
	$(PROJECTORRAYS_SRC_DIR)/lingodec/ast.cpp \
	$(PROJECTORRAYS_SRC_DIR)/lingodec/context.cpp \
	$(PROJECTORRAYS_SRC_DIR)/lingodec/handler.cpp \
	$(PROJECTORRAYS_SRC_DIR)/lingodec/names.cpp \
	$(PROJECTORRAYS_SRC_DIR)/lingodec/script.cpp

.PHONY: all
all: wasm

$(PROJECTORRAYS_FONTMAP_DIR)/%.h: $(PROJECTORRAYS_FONTMAP_DIR)/%.txt
	@cd $(PROJECTORRAYS_DIR) && xxd -i fontmaps/$*.txt > fontmaps/$*.h

.PHONY: wasm
wasm: $(FONTMAP_HEADERS)
	@if [ "$(WASM_MPG123)" = "1" ] && [ ! -f "$(MPG123_WASM_LIB)" ]; then \
		echo "Missing $(MPG123_WASM_LIB)! Run 'make wasm-mpg123' first."; \
		exit 1; \
	fi
	mkdir -p $(DIST_DIR)
	emcc $(CPPFLAGS) -std=c++17 -Wall -Wextra -I$(PROJECTORRAYS_SRC_DIR) -Isrc/cpp/emscripten $(WASM_MPG123_CFLAGS) -O2 -fexceptions $(if $(filter 0,$(WASM_MPG123)),-DPROJECTORRAYS_DISABLE_MPG123,) \
		$(WASM_SOURCES) -o $(WASM_OUTPUT) $(WASM_MPG123_LIBS) \
		-s USE_ZLIB=1 -s ALLOW_MEMORY_GROWTH=1 -s DISABLE_EXCEPTION_CATCHING=0 \
		-s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
		-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","HEAPU8","HEAPU32"]'
	cp -f $(WASM_OUTPUT) $(WASM_CJS_OUTPUT)
	emcc $(CPPFLAGS) -std=c++17 -Wall -Wextra -I$(PROJECTORRAYS_SRC_DIR) -Isrc/cpp/emscripten $(WASM_MPG123_CFLAGS) -O2 -fexceptions $(if $(filter 0,$(WASM_MPG123)),-DPROJECTORRAYS_DISABLE_MPG123,) \
		$(WASM_SOURCES) -o $(WASM_SINGLE_OUTPUT) $(WASM_MPG123_LIBS) \
		-s USE_ZLIB=1 -s ALLOW_MEMORY_GROWTH=1 -s DISABLE_EXCEPTION_CATCHING=0 -s SINGLE_FILE=1 \
		-s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
		-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","HEAPU8","HEAPU32"]'

.PHONY: wasm-mpg123
wasm-mpg123:
	mkdir -p $(MPG123_WASM_BUILD_DIR)
	cd $(MPG123_WASM_BUILD_DIR) && emconfigure ../configure --disable-shared --enable-static --disable-assembly --with-cpu=generic --host=wasm32-unknown-emscripten --disable-maintainer-mode
	touch $(MPG123_DIR)/configure
	EMCC_CFLAGS="-O2" emmake make -C $(MPG123_WASM_BUILD_DIR) ACLOCAL=: AUTOCONF=: AUTOMAKE=: AUTOHEADER=:

.PHONY: clean
clean:
	-rm $(FONTMAP_HEADERS) $(WASM_OUTPUT) $(WASM_CJS_OUTPUT) $(DIST_DIR)/projectorrays.wasm

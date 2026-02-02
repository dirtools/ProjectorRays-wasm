/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

#include <cstddef>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#include "common/stream.h"
#include "director/chunk.h"
#include "director/dirfile.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE uint8_t *projectorrays_decompile(
	const uint8_t *input,
	size_t inputSize,
	size_t *outputSize
) {
	if (!input || inputSize == 0 || !outputSize) {
		return nullptr;
	}

	*outputSize = 0;

	try {
		Common::ReadStream stream(const_cast<uint8_t *>(input), inputSize);
		auto dir = std::make_unique<Director::DirectorFile>();
		if (!dir->read(&stream)) {
			return nullptr;
		}

		dir->config->unprotect();
		dir->parseScripts();
		dir->restoreScriptText();

		std::vector<uint8_t> output = dir->writeToBuffer();
		if (output.empty()) {
			return nullptr;
		}

		uint8_t *out = static_cast<uint8_t *>(std::malloc(output.size()));
		if (!out) {
			return nullptr;
		}
		std::memcpy(out, output.data(), output.size());
		*outputSize = output.size();
		return out;
	} catch (...) {
		return nullptr;
	}
}

EMSCRIPTEN_KEEPALIVE void projectorrays_free(uint8_t *buffer) {
	std::free(buffer);
}

} // extern "C"

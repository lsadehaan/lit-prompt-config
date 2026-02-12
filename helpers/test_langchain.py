"""Tests for langchain.py pure helper functions (no LangChain imports needed)."""

import pytest
from langchain import (
    extract_variables,
    convert_template,
    get_provider,
    get_model_kwargs,
)


class TestExtractVariables:
    def test_extracts_variable_names(self):
        result = extract_variables("Hello {{name}}, your order {{orderId}} is ready")
        assert set(result) == {"name", "orderId"}

    def test_returns_unique_variables(self):
        result = extract_variables("{{name}} said hello to {{name}}")
        assert result == ["name"]

    def test_returns_empty_for_no_variables(self):
        result = extract_variables("Hello world")
        assert result == []

    def test_handles_none(self):
        result = extract_variables(None)
        assert result == []

    def test_handles_empty_string(self):
        result = extract_variables("")
        assert result == []


class TestConvertTemplate:
    def test_converts_double_braces_to_single(self):
        result = convert_template("Hello {{name}}!")
        assert result == "Hello {name}!"

    def test_converts_multiple_variables(self):
        result = convert_template("{{greeting}} {{name}}")
        assert result == "{greeting} {name}"

    def test_handles_none(self):
        result = convert_template(None)
        assert result == ""

    def test_handles_empty_string(self):
        result = convert_template("")
        assert result == ""

    def test_preserves_text_without_variables(self):
        result = convert_template("Hello world")
        assert result == "Hello world"


class TestGetProvider:
    def test_extracts_provider_from_model_id(self):
        assert get_provider("anthropic/claude-sonnet-4-5") == "anthropic"
        assert get_provider("openai/gpt-4o") == "openai"
        assert get_provider("google/gemini-pro") == "google"

    def test_returns_model_name_when_no_slash(self):
        assert get_provider("gpt-4o") == "gpt-4o"

    def test_returns_unknown_for_empty_string(self):
        assert get_provider("") == "unknown"

    def test_handles_multiple_slashes(self):
        assert get_provider("meta-llama/llama-3/70b") == "meta-llama"


class TestGetModelKwargs:
    @pytest.fixture
    def base_config(self):
        return {
            "temperature": 1.0,
            "maxTokens": 4096,
            "topP": 1.0,
            "stopSequences": [],
        }

    def test_includes_temperature_and_max_tokens(self, base_config):
        base_config["temperature"] = 0.7
        base_config["maxTokens"] = 2048

        result = get_model_kwargs(base_config)

        assert result["temperature"] == 0.7
        assert result["max_tokens"] == 2048

    def test_excludes_top_p_when_1(self, base_config):
        base_config["topP"] = 1.0

        result = get_model_kwargs(base_config)

        assert "top_p" not in result

    def test_includes_top_p_when_not_1(self, base_config):
        base_config["topP"] = 0.9

        result = get_model_kwargs(base_config)

        assert result["top_p"] == 0.9

    def test_includes_stop_sequences(self, base_config):
        base_config["stopSequences"] = ["END", "STOP"]

        result = get_model_kwargs(base_config)

        assert result["stop"] == ["END", "STOP"]

    def test_excludes_stop_when_empty(self, base_config):
        base_config["stopSequences"] = []

        result = get_model_kwargs(base_config)

        assert "stop" not in result

    def test_uses_defaults_for_missing_values(self):
        result = get_model_kwargs({})

        assert result["temperature"] == 1.0
        assert result["max_tokens"] == 4096
